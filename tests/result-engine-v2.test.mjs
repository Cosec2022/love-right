import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { archetypeModelV2 } from "../public/app/models/archetype-model.js";
import { ArchetypeClassifier } from "../public/app/engine/archetype-classifier.js";
import { resolveOutcome } from "../public/app/engine/outcome-resolver.js";
import { StoryEngine } from "../public/app/engine/story-engine.js";
import { ScoreEngine } from "../public/app/engine/score-engine.js";
import { ResultEngine } from "../public/app/engine/result-engine.js";

const story = JSON.parse(await readFile(new URL("../public/stories/story-03/story.json", import.meta.url), "utf8"));
const results = JSON.parse(await readFile(new URL("../public/stories/story-03/results.json", import.meta.url), "utf8"));
const memory = () => ({ load: () => null, save: () => {}, clear: () => {} });

test("v2 global model has eight distinct canonical archetypes", () => {
  assert.equal(archetypeModelV2.modelVersion, 2);
  assert.equal(archetypeModelV2.archetypes.length, 8);
  assert.equal(new Set(archetypeModelV2.archetypes.map((item) => JSON.stringify(item.canonicalPrototype))).size, 8);
});

test("canonical profiles self-classify and ignore unobserved axes", () => {
  const classifier = new ArchetypeClassifier();
  for (const model of archetypeModelV2.archetypes) {
    const reliability = Object.fromEntries(archetypeModelV2.archetypes.flatMap((item) => Object.keys(item.canonicalPrototype)).map((axis) => [axis, 1]));
    const profile = { ...Object.fromEntries(Object.keys(reliability).map((axis) => [axis, 0])), ...model.canonicalPrototype };
    assert.equal(classifier.classify(profile, reliability).primary.id, model.id);
  }
  const profile = { approach: .7, expression: .5, certainty: .3, autonomy: -1 };
  assert.equal(classifier.classify(profile, { approach:1, expression:1, certainty:1, autonomy:0 }).primary.id, "direct-pursuit");
});

test("story 03 uses v2 without legacy classification data and preserves outcomes", () => {
  assert.equal(results.modelVersion, 2);
  assert.ok(results.archetypes.every((item) => !Object.hasOwn(item, "center") && !Object.hasOwn(item, "bias") && !Object.hasOwn(item, "gates")));
  const expected = ["now", "relearn", "clarify", "friend"];
  for (let index = 0; index < 4; index += 1) {
    const engine = new StoryEngine(story, { store: memory() }); engine.start();
    while (!engine.state.complete) { const scene = engine.getCurrentScene(); engine.choose(scene.choices[Math.min(index, scene.choices.length - 1)].id); }
    const result = new ResultEngine(story, results, new ScoreEngine(story)).build(engine.state);
    assert.equal(engine.state.answers.length, 18);
    assert.equal(result.outcome, expected[index]);
    assert.equal(result.classification.modelVersion, 2);
    assert.equal(result.classification.source, "global-archetype-model");
    assert.ok(result.memory.title && result.ending.every(Boolean));
  }
});

test("outcome resolution is independent of archetype", () => {
  assert.equal(resolveOutcome({ outcome: "friend", archetype: { id: "direct-pursuit" } }), "friend");
});
