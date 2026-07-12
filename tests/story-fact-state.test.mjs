import test from "node:test";
import assert from "node:assert/strict";
import { createInitialFactState, applyHardEffect, applySoftEffect, hasFact, restoreFactState } from "../public/app/engine/story-fact-state.js";
import { resolveOutcome } from "../public/app/engine/outcome-resolver.js";

test("hard facts persist while soft effects cannot change them", () => {
  const hard = applyHardEffect(createInitialFactState(), { id:"enter", hardEffect:{ sets:["entered"], knowledgeChanges:{ truth:true } } });
  assert.equal(hasFact(hard, "entered"), true);
  assert.equal(applySoftEffect(hard, { softEffect:{ perspective:"careful" } }).hardFacts.entered, true);
  assert.equal(restoreFactState(hard).knowledge.truth, true);
});

test("outcomes use facts, with optional deterministic hidden ending", () => {
  const story = { outcomeContract:{ officialEndings:[{id:"a",requiredHardFacts:["x"],forbiddenHardFacts:["y"]},{id:"b",requiredHardFacts:["y"],forbiddenHardFacts:["x"]}], hiddenEnding:null } };
  assert.equal(resolveOutcome({ story, factState:{ hardFacts:{x:true} } }).id, "a");
});
