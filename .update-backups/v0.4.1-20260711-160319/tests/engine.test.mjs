import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { StoryEngine } from "../public/app/engine/story-engine.js";
import { ScoreEngine } from "../public/app/engine/score-engine.js";
import { ResultEngine } from "../public/app/engine/result-engine.js";
import { evaluateCondition } from "../public/app/engine/condition-evaluator.js";

const story = JSON.parse(await readFile(new URL("../public/stories/story-01/story.json", import.meta.url), "utf8"));
const results = JSON.parse(await readFile(new URL("../public/stories/story-01/results.json", import.meta.url), "utf8"));
const memoryStore = () => {
  let value = null;
  return { load: () => value, save: (_id, state) => { value = structuredClone(state); }, clear: () => { value = null; } };
};

test("condition evaluator supports nested rules", () => {
  const context = { traits: { spark: 75, autonomy: 40 }, flags: { route: "newLead" } };
  assert.equal(evaluateCondition({ all: [{ trait: "spark", gte: 70 }, { flag: "route", equals: "newLead" }] }, context), true);
  assert.equal(evaluateCondition({ any: [{ trait: "autonomy", gte: 70 }, { trait: "spark", lt: 60 }] }, context), false);
});

test("two respectful declines switch to the new-lead route", () => {
  const engine = new StoryEngine(story, { store: memoryStore() });
  engine.start();
  engine.choose("d");
  assert.equal(engine.state.currentSceneId, "s02_reencounter");
  engine.choose("d");
  assert.equal(engine.state.flags.route, "newLead");
  assert.equal(engine.state.currentSceneId, "s03_new_lead");
  engine.choose("a");
  assert.equal(engine.state.currentSceneId, "s04_new_lead");
});

test("reopening the conversation uses the respectful rain branch", () => {
  const engine = new StoryEngine(story, { store: memoryStore() });
  engine.start();
  engine.choose("d");
  engine.choose("a");
  assert.equal(engine.state.flags.route, "reopened");
  assert.equal(engine.state.currentSceneId, "s03_reopened");
});

test("back restores branch flags, answers and raw scores", () => {
  const engine = new StoryEngine(story, { store: memoryStore() });
  engine.start();
  engine.choose("d");
  const before = structuredClone(engine.state);
  engine.choose("d");
  assert.equal(engine.state.flags.route, "newLead");
  assert.equal(engine.back(), true);
  assert.deepEqual(engine.state.answers, before.answers);
  assert.deepEqual(engine.state.rawTraits, before.rawTraits);
  assert.equal(engine.state.flags.route, "declined");
  assert.equal(engine.state.currentSceneId, "s02_reencounter");
});

test("a complete route reaches a result in exactly 18 answers", () => {
  const engine = new StoryEngine(story, { store: memoryStore() });
  engine.start();
  let guard = 0;
  while (!engine.state.complete && guard < 30) {
    engine.choose("a");
    guard += 1;
  }
  assert.equal(engine.state.complete, true);
  assert.equal(engine.state.answers.length, 18);
  assert.equal(engine.state.outcome, "leap");

  const scorer = new ScoreEngine(story);
  const resultEngine = new ResultEngine(story, results, scorer);
  const result = resultEngine.build(engine.state);
  assert.ok(result.archetype.title);
  assert.equal(Object.keys(result.traits).length, 12);
  assert.equal(Object.keys(result.meters).length, 8);
  for (const score of Object.values(result.traits)) assert.ok(score >= 8 && score <= 92);
  assert.equal(result.future.length, 3);
});
