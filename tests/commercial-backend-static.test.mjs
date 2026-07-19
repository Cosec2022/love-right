import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("profile responses never expose session token hashes", () => {
  assert.match(source, /user:\s*\{\s*loveId:\s*user\.loveId,\s*nickname:\s*user\.nickname\s*\}/s);
  assert.doesNotMatch(source, /user:\s*user,\s*summary/);
});

test("vote retrieval and one-vote update routes are both implemented", () => {
  assert.match(source, /request\.method === "GET" && voteMatch/);
  assert.match(source, /request\.method === "PUT" && voteMatch/);
  assert.match(source, /ON CONFLICT\(love_id, story_id\)/);
});


test("completion storage replays the eighteen choices instead of trusting client labels", () => {
  assert.match(source, /verifyCompletion\(request, env, story, body\.answerPath\)/);
  assert.match(source, /answerPath\.length !== 18/);
  assert.match(source, /new ResultEngine\(storySpec, resultsSpec, new ScoreEngine\(storySpec\)\)/);
  assert.match(source, /selectFourCharacterLabel\(result\)/);
  assert.doesNotMatch(source, /const labelTitle = String\(body\.labelTitle/);
});
