import test from "node:test";
import assert from "node:assert/strict";
import { aggregateCompletions, normalizeLoveId, sortStoryRanking, validateIdentity } from "../src/lib/core.js";
import { FOUR_CHARACTER_LABELS, LABEL_AXES, portraitCode, selectFourCharacterLabel } from "../public/app/commercial/label-engine.js";
import { CommercialController } from "../public/app/commercial/commercial-controller.js";

test("commercial identity is ID plus nickname with no password field", () => {
  assert.deepEqual(validateIdentity(" moon-7286 ", "阿月"), { loveId: "MOON-7286", nickname: "阿月" });
  assert.equal(normalizeLoveId("lr_test"), "LR_TEST");
  assert.throws(() => validateIdentity("abc", "阿月"));
});

test("six votes remain new and seven votes enter approval ranking", () => {
  const stories = [
    { id: "story-01", title: "旧" },
    { id: "story-02", title: "新" },
    { id: "story-03", title: "口碑" }
  ];
  const ranking = sortStoryRanking(stories, [
    { story_id: "story-01", up_votes: 6, down_votes: 0 },
    { story_id: "story-03", up_votes: 6, down_votes: 1 }
  ]);
  assert.equal(ranking[0].storyId, "story-03");
  assert.equal(ranking[0].ratingEligible, true);
  assert.equal(ranking[1].storyId, "story-02");
  assert.equal(ranking[2].storyId, "story-01");
});


test("catalog renderer keeps newer stories ahead when eligible scores tie", () => {
  const controller = new CommercialController({});
  controller.ranking = [
    { storyId: "story-01", approvalRate: 0.8, totalVotes: 10, ratingEligible: true, freshness: 0 },
    { storyId: "story-02", approvalRate: 0.8, totalVotes: 10, ratingEligible: true, freshness: 1 }
  ];
  const ranked = controller.rankCatalog({ stories: [
    { id: "story-01", title: "旧", status: "published" },
    { id: "story-02", title: "新", status: "published" }
  ]});
  assert.deepEqual(ranked.stories.map((story) => story.id), ["story-02", "story-01"]);
});

test("there are exactly sixteen distinct four-character labels", () => {
  assert.equal(FOUR_CHARACTER_LABELS.length, 16);
  assert.equal(new Set(FOUR_CHARACTER_LABELS.map((item) => item.id)).size, 16);
  assert.equal(FOUR_CHARACTER_LABELS.every((item) => [...item.title].length === 4), true);
});

test("label selection is deterministic and independent from the legacy archetype", () => {
  const result = {
    archetype: { id: "romantic-resonance" },
    traits: { care: 80, expression: 72, idealization: 68, validation: 35 }
  };
  const first = selectFourCharacterLabel(result);
  const second = selectFourCharacterLabel(result);
  assert.deepEqual(first, second);
  assert.equal(first.code, 14);
  assert.equal(first.title, "灵魂同谋");

  const sameTraitsDifferentLegacyType = selectFourCharacterLabel({
    archetype: { id: "direct-pursuit" },
    traits: result.traits
  });
  assert.equal(sameTraitsDifferentLegacyType.id, first.id);
});

test("all sixteen portrait combinations map to sixteen unique labels", () => {
  const ids = new Set();
  for (let code = 0; code < 16; code += 1) {
    const traits = {
      care: code & 8 ? LABEL_AXES.care.threshold : LABEL_AXES.care.threshold - 1,
      expression: code & 4 ? LABEL_AXES.expression.threshold : LABEL_AXES.expression.threshold - 1,
      idealization: code & 2 ? LABEL_AXES.idealization.threshold : LABEL_AXES.idealization.threshold - 1,
      validation: code & 1 ? LABEL_AXES.validation.threshold : LABEL_AXES.validation.threshold - 1
    };
    assert.equal(portraitCode(traits), code);
    ids.add(selectFourCharacterLabel({ traits }).id);
  }
  assert.equal(ids.size, 16);
});

test("profile aggregation counts unique stories and recurring labels", () => {
  const rows = [
    { story_id: "story-01", label_id: "moon", label_title: "月光共犯", traits_json: '{"trust":60}' },
    { story_id: "story-01", label_id: "moon", label_title: "月光共犯", traits_json: '{"trust":80}' },
    { story_id: "story-02", label_id: "free", label_title: "自由盟友", traits_json: '{"trust":40}' }
  ];
  const summary = aggregateCompletions(rows);
  assert.equal(summary.completedStories, 2);
  assert.equal(summary.topLabels[0].count, 2);
  assert.equal(summary.averageTraits.trust, 60);
});
