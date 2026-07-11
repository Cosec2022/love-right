import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { StoryEngine } from "../public/app/engine/story-engine.js";
import { ScoreEngine } from "../public/app/engine/score-engine.js";
import { ResultEngine } from "../public/app/engine/result-engine.js";
import { evaluateCondition } from "../public/app/engine/condition-evaluator.js";

const catalog = JSON.parse(await readFile(new URL("../public/stories/catalog.json", import.meta.url), "utf8"));
const loadPackage = async (entry) => {
  const story = JSON.parse(await readFile(new URL(`../public/${entry.storyUrl.replace(/^\.\//, "")}`, import.meta.url), "utf8"));
  const results = JSON.parse(await readFile(new URL(`../public/${entry.resultsUrl.replace(/^\.\//, "")}`, import.meta.url), "utf8"));
  return { story, results };
};
const packages = await Promise.all(catalog.stories.map(loadPackage));
const publishedPackages = packages.filter(({ story }) => story.status === "published");
const memoryStore = () => {
  let value = null;
  return { load: () => value, save: (_id, state) => { value = structuredClone(state); }, clear: () => { value = null; } };
};

function completeWithPattern(story, choiceIndex) {
  const engine = new StoryEngine(story, { store: memoryStore() });
  engine.start();
  let guard = 0;
  while (!engine.state.complete && guard < 40) {
    const current = engine.getCurrentScene();
    const choice = current.choices[Math.min(choiceIndex, current.choices.length - 1)];
    engine.choose(choice.id);
    guard += 1;
  }
  return engine;
}

test("condition evaluator supports nested and spatial path rules", () => {
  const context = {
    traits: { approach: 65, autonomy: 44 },
    flags: { route: "steady" },
    spatial: { consistency: { approach: 0.63 } }
  };
  assert.equal(evaluateCondition({ all: [{ trait: "approach", gte: 60 }, { flag: "route", equals: "steady" }] }, context), true);
  assert.equal(evaluateCondition({ path: "spatial.consistency.approach", op: "<=", value: 0.7 }, context), true);
});

test("all published stories complete in exactly 18 answers and build spatial results", async () => {
  for (const { story, results } of publishedPackages) {
    const engine = completeWithPattern(story, 0);
    assert.equal(engine.state.complete, true, story.id);
    assert.equal(engine.state.answers.length, 18, story.id);

    const scorer = new ScoreEngine(story);
    const result = new ResultEngine(story, results, scorer).build(engine.state);
    assert.ok(result.archetype.title, story.id);
    assert.equal(Object.keys(result.traits).length, 16, story.id);
    assert.equal(Object.keys(result.meters).length, 8, story.id);
    assert.equal(result.future.length, 3, story.id);
    assert.equal(result.spatial.answerMatrix.length, 18, story.id);
    assert.ok(result.ending.every(Boolean), `${story.id}: ending`);
    assert.ok(result.psychology.every(Boolean), `${story.id}: psychology`);
    assert.ok(result.history.length >= 2, `${story.id}: history`);
    for (const score of Object.values(result.traits)) assert.ok(score >= 8 && score <= 92, `${story.id}:${score}`);
  }
});

test("back restores vectors, flags, answers and branch position", async () => {
  const { story } = packages.find(({ story }) => story.id === "story-02");
  const engine = new StoryEngine(story, { store: memoryStore() });
  engine.start();
  engine.choose("a");
  engine.choose("a");
  engine.choose("d");
  const before = structuredClone(engine.state);
  engine.choose("a");
  assert.equal(engine.back(), true);
  assert.deepEqual(engine.state.answers, before.answers);
  assert.deepEqual(engine.state.rawTraits, before.rawTraits);
  assert.deepEqual(engine.state.flags, before.flags);
  assert.equal(engine.state.currentSceneId, before.currentSceneId);
});

test("lead preference quietly changes early, middle and late story copy", async () => {
  const { story } = packages.find(({ story }) => story.id === "story-03");
  for (const [choiceId, appeal] of [["a", "steady"], ["b", "witty"], ["c", "gentle"], ["d", "direct"]]) {
    const engine = new StoryEngine(story, { store: memoryStore() });
    engine.start();
    engine.choose("a");
    engine.choose("a");
    engine.choose(choiceId);
    engine.choose("a");
    engine.choose("a");
    assert.equal(engine.state.currentSceneId, `s06_${appeal}`);

    while (!engine.state.complete && engine.getCurrentScene().slot < 12) engine.choose(engine.getCurrentScene().choices[0].id);
    assert.equal(engine.state.currentSceneId, `s12_${appeal}`);

    while (!engine.state.complete && engine.getCurrentScene().slot < 17) engine.choose(engine.getCurrentScene().choices[0].id);
    assert.equal(engine.state.currentSceneId, `s17_${appeal}`);
    assert.equal(engine.state.answers.length, 16);
  }
});

test("selected appeal style is reflected in suitable-partner copy", async () => {
  const { story, results } = packages.find(({ story }) => story.id === "story-02");
  const engine = new StoryEngine(story, { store: memoryStore() });
  engine.start();
  engine.choose("a");
  engine.choose("a");
  engine.choose("d");
  while (!engine.state.complete) engine.choose(engine.getCurrentScene().choices[0].id);
  const result = new ResultEngine(story, results, new ScoreEngine(story)).build(engine.state);
  assert.match(result.match.text, /把偏爱说清/);
});

test("deterministic A/B/C/D routes no longer collapse into one result", async () => {
  for (const { story, results } of publishedPackages) {
    const resultEngine = new ResultEngine(story, results, new ScoreEngine(story));
    const archetypes = [];
    for (let index = 0; index < 4; index += 1) {
      const result = resultEngine.build(completeWithPattern(story, index).state);
      archetypes.push(result.archetype.id);
      if (result.archetype.secondary) {
        const pair = [result.archetype.id, result.archetype.secondary.id].sort().join("::");
        const configured = new Set((results.spatialModel?.blendPairs ?? []).map((item) => [...item].sort().join("::")));
        assert.equal(configured.has(pair), true, `${story.id}: invalid blend ${pair}`);
      }
    }
    assert.ok(new Set(archetypes).size >= 3, `${story.id}: ${archetypes.join(",")}`);
  }
});

test("male-target story is present and uses a female lead", async () => {
  const { story } = packages.find(({ story }) => story.id === "story-04");
  assert.equal(story.metadata.audience, "male");
  assert.match(story.metadata.subtitle, /她/);
  assert.equal(story.metadata.tags.includes("男性视角"), true);
});
