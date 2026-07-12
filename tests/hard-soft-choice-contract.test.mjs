import test from "node:test";
import assert from "node:assert/strict";
import { validateStoryContract } from "../public/app/engine/story-contract-validator.js";
const base = (choice) => ({ id:"v2", storyContractVersion:2, scenes:[{id:"s01",slot:1,choices:[choice]}] });
const hard = { id:"a", questionType:"hard", sceneTrigger:"门被敲响", whyNow:"对方正在等待", hardEffect:{ action:"开门", sets:["door-open"], requiredCallbacks:["acknowledge-door"] } };
const soft = { id:"b", questionType:"soft", sceneTrigger:"对方解释完毕", whyNow:"玩家需要回应", softEffect:{ perspective:"信任程度", responseVariant:"quiet", profileEvidence:{ trust:.2 } } };
test("v2 accepts hard and soft contracts", () => { assert.doesNotThrow(() => validateStoryContract(base(hard))); assert.doesNotThrow(() => validateStoryContract(base(soft))); });
test("v2 rejects missing hard facts, callbacks and invalid soft effects", () => {
  assert.throws(() => validateStoryContract(base({ ...hard, hardEffect:{ action:"开门", requiredCallbacks:[] } })), /factual change/);
  assert.throws(() => validateStoryContract(base({ ...hard, hardEffect:{ action:"开门", sets:["x"] } })), /requiredCallbacks/);
  assert.throws(() => validateStoryContract(base({ ...soft, softEffect:{ perspective:"x", responseVariant:"y", sets:["wedding-cancelled"] } })), /cannot contain sets/);
});
test("v2 rejects quotas and unsupported versions with locations", () => {
  assert.throws(() => validateStoryContract(base({ ...hard, targetDistribution:"equal" })), /forbidden contract field targetDistribution/);
  assert.throws(() => validateStoryContract({ ...base(hard), storyContractVersion:3 }), /unsupported/);
});
