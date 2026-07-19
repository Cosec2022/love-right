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
    assert.ok(result.memory.title, `${story.id}: memory title`);
    assert.ok(result.memory.hook, `${story.id}: memory hook`);
    assert.equal(result.memory.insights.length, 3, `${story.id}: three memorable insights`);
    assert.equal(result.memory.indices.length, 6, `${story.id}: six emotional indices`);
    assert.equal(result.memory.moves.length, 4, `${story.id}: four relationship moves`);
    const indexValues = result.memory.indices.map((item) => item.value);
    assert.ok(indexValues.every((value) => value >= 18 && value <= 92), `${story.id}: emotional index range`);
    assert.ok(Math.max(...indexValues) - Math.min(...indexValues) >= 20, `${story.id}: emotional indices need contrast`);
    assert.equal(result.evidence.length, 3, `${story.id}: three story moments`);
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


test("memory-first titles stay distinct and avoid parameter-style naming", async () => {
  for (const { story, results } of publishedPackages) {
    const resultEngine = new ResultEngine(story, results, new ScoreEngine(story));
    const titles = [];
    for (let index = 0; index < 4; index += 1) {
      const result = resultEngine.build(completeWithPattern(story, index).state);
      titles.push(result.memory.title);
      assert.equal(/型$/.test(result.memory.title), false, `${story.id}: ${result.memory.title}`);
      assert.equal(result.memory.title.includes("分"), false, `${story.id}: ${result.memory.title}`);
      assert.notEqual(result.memory.title, "最想被坚定选择的人", `${story.id}: awkward legacy title`);
    }
    assert.ok(new Set(titles).size >= 3, `${story.id}: ${titles.join(",")}`);
  }
});


test("romantic ending is first-class and substantially written", async () => {
  for (const { story, results } of publishedPackages) {
    const result = new ResultEngine(story, results, new ScoreEngine(story)).build(completeWithPattern(story, 0).state);
    assert.ok(result.ending.length >= 2, `${story.id}: ending has scene and echo`);
    assert.ok(result.ending[0].length >= 80, `${story.id}: ending should carry a full romantic scene`);
  }
});

test("new male stories have real plot-dependent branches", async () => {
  const competition = packages.find(({ story }) => story.id === "story-05").story;
  const backupTargets = competition.scenes.find((scene) => scene.id === "s08").choices.map((choice) => choice.next);
  assert.equal(new Set(backupTargets).size, 4, "story-05 backup decision must change the next scene");

  const anonymous = packages.find(({ story }) => story.id === "story-06").story;
  const revealTargets = anonymous.scenes.find((scene) => scene.id === "s15").choices.map((choice) => choice.next);
  assert.equal(new Set(revealTargets).size, 4, "story-06 reveal decision must change the identity scene");
});

test("new male-target stories use female leads and private-type attraction copy", async () => {
  const maleStories = publishedPackages.map(({ story }) => story).filter((story) => ["story-05", "story-06"].includes(story.id));
  assert.equal(maleStories.length, 2);
  for (const story of maleStories) {
    assert.match(story.metadata.subtitle, /她/);
    const opening = story.scenes.slice(0, 3).flatMap((scene) => scene.content.map((item) => item.text)).join(" ");
    assert.match(opening, /类型|注意|吸引|好看/);
  }
});

test("emotional aftermath is carried into the next scene and restored by back", () => {
  const { story } = packages.find(({ story }) => story.id === "story-01");
  const engine = new StoryEngine(story, { store: memoryStore() });
  engine.start();
  while (engine.getCurrentScene().id !== "s08_name") engine.choose(engine.getCurrentScene().choices[0].id);
  const before = structuredClone(engine.state);
  engine.choose("b");
  const next = engine.getCurrentScene();
  assert.equal(next.id, "s09_emotion");
  assert.equal(next.content[0].type, "continuity");
  assert.match(next.content[0].text, /距离|不舒服|冷/);
  assert.ok(engine.state.relationship.guard !== before.relationship.guard || engine.state.relationship.hurt !== before.relationship.hurt);
  assert.equal(engine.back(), true);
  assert.deepEqual(engine.state.relationship, before.relationship);
  assert.equal(engine.state.pendingAftermath, before.pendingAftermath);
});

test("high-stakes scenes explicitly acknowledge every user response", () => {
  const expected = {
    "story-01": ["s08_name", "s10_confession", "s12_cancel", "s16_missing"],
    "story-02": ["s09", "s13", "s15"],
    "story-03": ["s09", "s13", "s16"],
    "story-04": ["s08", "s13", "s15"],
    "story-05": ["s08", "s10", "s13", "s15"],
    "story-06": ["s07", "s08", "s10", "s13", "s15"],
    "story-07": ["s04", "s09", "s12", "s13", "s14", "s16", "s17", "s18"]
  };
  for (const { story } of publishedPackages) {
    for (const sceneId of expected[story.id] ?? []) {
      const scene = story.scenes.find((item) => item.id === sceneId);
      assert.ok(scene, `${story.id}/${sceneId}`);
      for (const choice of scene.choices) {
        assert.ok(choice.aftermath?.length >= 24, `${story.id}/${sceneId}/${choice.id} needs emotional follow-through`);
      }
    }
  }
});

test("active, cautious, warm-to-cold and cold-to-warm routes leave distinct emotional climates", () => {
  const signatures = [];
  const { story } = packages.find(({ story }) => story.id === "story-05");
  const patterns = [
    [0, 0],
    [1, 1],
    [0, 3],
    [3, 0]
  ];
  for (const [firstHalf, secondHalf] of patterns) {
    const engine = new StoryEngine(story, { store: memoryStore() });
    engine.start();
    while (!engine.state.complete) {
      const scene = engine.getCurrentScene();
      const index = scene.slot <= 9 ? firstHalf : secondHalf;
      engine.choose(scene.choices[Math.min(index, scene.choices.length - 1)].id);
    }
    const r = engine.state.relationship;
    signatures.push([r.warmth, r.trust, r.guard, r.hurt, r.tension, r.repair].map((v) => v.toFixed(2)).join("|"));
  }
  assert.equal(new Set(signatures).size, 4, signatures.join("\n"));
});

test("story-06 keeps one stable emotional spine before the final identity choice", () => {
  const { story } = packages.find(({ story }) => story.id === "story-06");
  assert.ok(story.scenes.length <= 22, `story-06 has too many scene nodes: ${story.scenes.length}`);

  for (const [sceneId, expectedTarget] of [["s07", "s08"], ["s08", "s09"], ["s10", "s11"], ["s13", "s14"]]) {
    const scene = story.scenes.find((item) => item.id === sceneId);
    assert.ok(scene, sceneId);
    assert.deepEqual(new Set(scene.choices.map((choice) => choice.next)), new Set([expectedTarget]), `${sceneId} should remain on the shared spine`);
  }

  const identityContext = story.scenes.find((item) => item.id === "s12");
  assert.equal(identityContext.variants.length, 4, "privacy choices should alter copy rather than create four world lines");
  assert.deepEqual(new Set(identityContext.choices.map((choice) => choice.next)), new Set(["s13"]));

  const finalChoice = story.scenes.find((item) => item.id === "s15");
  assert.equal(new Set(finalChoice.choices.map((choice) => choice.next)).size, 4, "only the final identity choice should open four real routes");
  for (const branchId of ["s16_reveal", "s16_slow", "s16_anon", "s16_wait"]) {
    const branch = story.scenes.find((item) => item.id === branchId);
    assert.ok(branch, branchId);
    assert.deepEqual(new Set(branch.choices.map((choice) => choice.next)), new Set(["s17"]), `${branchId} should converge after acknowledging the route`);
  }
});


test("result heading speaks directly to the player", async () => {
  const rendererSource = await readFile(new URL("../public/app/ui/renderer.js", import.meta.url), "utf8");
  assert.match(rendererSource, /resultTitlePrefix\.textContent = "你是一个怎样的人"/);
  assert.match(rendererSource, /resultTitleCore\.textContent = fourCharacterLabel\?\.title \?\? result\.memory\.title/);
});


test("story-07 has a stable spine with only meaningful hard branches", () => {
  const { story } = packages.find(({ story }) => story.id === "story-07");
  assert.equal(story.metadata.audience, "male");
  assert.equal(new Set(story.scenes.find((scene) => scene.id === "s04").choices.map((choice) => choice.next)).size, 4);
  assert.equal(new Set(story.scenes.find((scene) => scene.id === "s09").choices.map((choice) => choice.next)).size, 1);
  assert.equal(new Set(story.scenes.find((scene) => scene.id === "s14").choices.map((choice) => choice.next)).size, 1);
  assert.equal(new Set(story.scenes.find((scene) => scene.id === "s18").choices.map((choice) => choice.outcome)).size, 4);
});

test("story-07 carries departure and workbench choices into later copy", () => {
  const { story } = packages.find(({ story }) => story.id === "story-07");
  const engine = new StoryEngine(story, { store: memoryStore() });
  engine.start();
  while (engine.getCurrentScene().id !== "s09") engine.choose(engine.getCurrentScene().choices[0].id);
  engine.choose("c");
  while (engine.getCurrentScene().id !== "s14") engine.choose(engine.getCurrentScene().choices[0].id);
  engine.choose("c");
  const s15 = engine.getCurrentScene();
  assert.match(s15.content.map((item) => item.text).join(" "), /童年划痕|木板/);
  while (engine.getCurrentScene().id !== "s17") engine.choose(engine.getCurrentScene().choices[0].id);
  const s17 = engine.getCurrentScene();
  assert.match(s17.content.map((item) => item.text).join(" "), /该不该等/);
});


test("story-07 visually distinguishes consequential choices and reveals the ending before analysis", async () => {
  const { story } = packages.find(({ story }) => story.id === "story-07");
  for (const sceneId of ["s04", "s09", "s14"]) {
    const scene = story.scenes.find((item) => item.id === sceneId);
    assert.equal(scene.decisionType, "hard", sceneId);
    assert.ok(scene.decisionLabel && scene.decisionNote, sceneId);
    assert.equal(scene.choices.every((choice) => choice.subtext?.length >= 8), true, sceneId);
  }
  const finalScene = story.scenes.find((item) => item.id === "s18");
  assert.equal(finalScene.decisionType, "final");
  assert.equal(finalScene.choices.every((choice) => choice.finalReveal?.title && choice.finalReveal.copy.length >= 40), true);
  assert.equal(new Set(finalScene.choices.map((choice) => choice.finalReveal.title)).size, 4);

  const rendererSource = await readFile(new URL("../public/app/ui/renderer.js", import.meta.url), "utf8");
  const mainSource = await readFile(new URL("../public/app/main.js", import.meta.url), "utf8");
  assert.match(rendererSource, /renderReveal/);
  assert.match(rendererSource, /decision-option/);
  assert.match(mainSource, /scene\.decisionType === "final"/);
});


test("story-07 completes every consequential decision combination", () => {
  const { story } = packages.find(({ story }) => story.id === "story-07");
  const decisionIds = ["s04", "s09", "s14", "s18"];
  const expectedOutcomes = ["return", "commute", "distance", "farewell"];
  let completed = 0;
  for (let a = 0; a < 4; a += 1) {
    for (let b = 0; b < 4; b += 1) {
      for (let c = 0; c < 4; c += 1) {
        for (let d = 0; d < 4; d += 1) {
          const picks = new Map(decisionIds.map((id, index) => [id, [a, b, c, d][index]]));
          const engine = new StoryEngine(story, { store: memoryStore() });
          engine.start();
          while (!engine.state.complete) {
            const scene = engine.getCurrentScene();
            const index = picks.get(scene.id) ?? ((scene.slot + a + b + c + d) % scene.choices.length);
            engine.choose(scene.choices[index].id);
          }
          assert.equal(engine.state.answers.length, 18);
          assert.equal(engine.state.outcome, expectedOutcomes[d]);
          completed += 1;
        }
      }
    }
  }
  assert.equal(completed, 256);
});
