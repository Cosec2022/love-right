import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const storyIds = ["story-08", "story-09", "story-10"];
const staleTerms = [
  "靠窗的位置",
  "许妍",
  "书店开门时",
  "最后一班渡船",
  "最早的一班车",
];
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

test("stories 08-10 use their own final reveal copy", () => {
  for (const storyId of storyIds) {
    const story = readJson(path.join(root, "public", "stories", storyId, "story.json"));
    const results = readJson(path.join(root, "public", "stories", storyId, "results.json"));
    const validCopies = new Set(Object.values(results.sections.ending.byOutcome));
    const finalScenes = story.scenes.filter((scene) => scene.slot === 18);

    assert.ok(finalScenes.length > 0, `${storyId}: final scene missing`);
    for (const scene of finalScenes) {
      assert.equal(scene.choices.length, 4, `${storyId}/${scene.id}: expected four choices`);
      for (const choice of scene.choices) {
        const reveal = choice.finalReveal;
        assert.ok(reveal, `${storyId}/${scene.id}/${choice.id}: finalReveal missing`);
        assert.ok(reveal.title.length >= 4, `${storyId}/${scene.id}/${choice.id}: title too short`);
        assert.ok(reveal.copy.length >= 80, `${storyId}/${scene.id}/${choice.id}: copy too short`);
        assert.ok(validCopies.has(reveal.copy), `${storyId}/${scene.id}/${choice.id}: copy is not from this story`);
        const combined = `${reveal.title}\n${reveal.copy}`;
        for (const term of staleTerms) {
          assert.equal(combined.includes(term), false, `${storyId}/${scene.id}/${choice.id}: stale term ${term}`);
        }
      }
    }
  }
});
