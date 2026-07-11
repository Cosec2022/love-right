import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const [, , slugArg, ...titleParts] = process.argv;
const title = titleParts.join(" ").trim();
if (!slugArg || !title) {
  console.error('Usage: npm run new-story -- <slug> "故事标题"');
  process.exit(1);
}
if (!/^[a-z0-9][a-z0-9-]{1,48}$/.test(slugArg)) {
  console.error("Slug must use lowercase letters, numbers and hyphens.");
  process.exit(1);
}

const root = path.resolve(new URL("..", import.meta.url).pathname);
const storyDir = path.join(root, "public", "stories", slugArg);
try {
  await access(storyDir);
  console.error(`Story directory already exists: ${storyDir}`);
  process.exit(1);
} catch {
  // Expected for a new story.
}
await mkdir(storyDir, { recursive: true });

// Reuse the canonical 16D space and shared result vocabulary. Drafts must be
// recalibrated with npm run audit before status can be changed to published.
const referenceStory = JSON.parse(await readFile(path.join(root, "public/stories/story-01/story.json"), "utf8"));
const referenceResults = JSON.parse(await readFile(path.join(root, "public/stories/story-01/results.json"), "utf8"));

const story = {
  schemaVersion: 2,
  id: slugArg,
  slug: slugArg,
  status: "draft",
  locale: "zh-CN",
  metadata: {
    series: "LOVE RIGHT · DRAFT",
    title,
    subtitle: "在这里填写一句能够让用户立刻进入情境的开场。",
    description: "在这里填写故事库卡片说明。",
    estimatedMinutes: 8,
    coverTheme: "night-rose",
    audience: "female",
    tags: ["互动剧情", "恋爱投射", "多结局"],
    disclaimer: "娱乐性叙事情境投射，不是心理诊断、事实识别或未来预言。"
  },
  space: structuredClone(referenceStory.space),
  traits: structuredClone(referenceStory.traits),
  initialScene: "s01_opening",
  scenes: [
    {
      id: "s01_opening",
      slot: 1,
      chapter: "01｜故事开始",
      context: "approach",
      content: [{ type: "paragraph", text: "把第一幕写在这里。每个选择都必须真正改变后续关系或空间向量。" }],
      prompt: "你会：",
      note: "这一幕主要测量靠近、信任与边界。",
      choices: [
        {
          id: "a",
          text: "主动靠近",
          vector: { approach: 0.7, trust: 0.3, novelty: 0.25 },
          intensity: 1,
          confidence: 0.9,
          next: "s02_response"
        },
        {
          id: "b",
          text: "先观察一下",
          vector: { approach: -0.25, discernment: 0.65, autonomy: 0.35 },
          intensity: 1,
          confidence: 0.9,
          next: "s02_response"
        }
      ]
    },
    {
      id: "s02_response",
      slot: 2,
      chapter: "02｜对方的回应",
      context: "ambiguity",
      content: [{ type: "paragraph", text: "让上一幕的选择在人物行为中留下痕迹。" }],
      prompt: "你更在意：",
      note: "不要写成四个同义答案。",
      choices: [
        {
          id: "a",
          text: "对方是否明确",
          vector: { certainty: 0.72, validation: 0.42, reassurance: 0.3 },
          intensity: 1,
          confidence: 0.9,
          next: "s03_decision"
        },
        {
          id: "b",
          text: "对方是否尊重边界",
          vector: { autonomy: 0.65, discernment: 0.45, trust: 0.18 },
          intensity: 1,
          confidence: 0.9,
          next: "s03_decision"
        }
      ]
    },
    {
      id: "s03_decision",
      slot: 3,
      chapter: "03｜你的决定",
      context: "commitment",
      content: [{ type: "paragraph", text: "用一个可分享的选择结束这个最小样例。正式故事固定为18个测量槽位。" }],
      prompt: "最后，你会：",
      note: "终局选择需要设置 outcome。",
      choices: [
        {
          id: "a",
          text: "走向对方",
          vector: { approach: 0.6, commitment: 0.65, trust: 0.35 },
          intensity: 1,
          confidence: 0.95,
          outcome: "approach",
          next: "$result"
        },
        {
          id: "b",
          text: "保留自己的节奏",
          vector: { autonomy: 0.68, commitment: -0.25, approach: -0.2 },
          intensity: 1,
          confidence: 0.95,
          outcome: "pause",
          next: "$result"
        }
      ]
    }
  ]
};

const results = {
  schemaVersion: 2,
  storyId: slugArg,
  spatialModel: structuredClone(referenceResults.spatialModel),
  meters: structuredClone(referenceResults.meters),
  archetypes: structuredClone(referenceResults.archetypes),
  sections: {
    ending: {
      byOutcome: {
        approach: "你决定向前一步。",
        pause: "你决定保留自己的节奏。"
      },
      appendRules: [{ default: true, text: "真正重要的是，这一步由你自己决定。" }]
    },
    psychology: {
      byArchetype: Object.fromEntries(referenceResults.archetypes.map((item) => [item.id, item.tagline])),
      appendRules: [{ default: true, text: "这只是故事中的投射，不是固定标签。" }]
    },
    history: {
      groups: [
        [{ default: true, text: "这里填写基于选择生成的过去模式推演。" }],
        [{ default: true, text: "这里填写第二条经历投射，避免整段报告只有一种解释。" }]
      ]
    },
    future: [
      { title: "相遇", rules: [{ default: true, text: "这里填写相遇场景。" }] },
      { title: "转折", rules: [{ default: true, text: "这里填写关系转折。" }] },
      { title: "稳定", rules: [{ default: true, text: "这里填写稳定后的关系画面。" }] }
    ],
    match: { base: "这里填写适配对象基础描述。", appendRules: [] },
    warning: { rules: [{ default: true, text: "这里填写最容易误判的关系信号。" }] }
  }
};

await writeFile(path.join(storyDir, "story.json"), JSON.stringify(story, null, 2) + "\n");
await writeFile(path.join(storyDir, "results.json"), JSON.stringify(results, null, 2) + "\n");

const catalogFile = path.join(root, "public", "stories", "catalog.json");
const catalog = JSON.parse(await readFile(catalogFile, "utf8"));
catalog.stories.push({
  id: slugArg,
  slug: slugArg,
  status: "draft",
  title,
  series: "LOVE RIGHT · DRAFT",
  description: "待填写故事说明。",
  estimatedMinutes: 8,
  audience: "female",
  coverTheme: "night-rose",
  storyUrl: `./stories/${slugArg}/story.json`,
  resultsUrl: `./stories/${slugArg}/results.json`
});
await writeFile(catalogFile, JSON.stringify(catalog, null, 2) + "\n");

console.log(`Created 16D spatial draft: public/stories/${slugArg}`);
console.log("Next: expand to 18 slots, calibrate results, then run npm run check.");
