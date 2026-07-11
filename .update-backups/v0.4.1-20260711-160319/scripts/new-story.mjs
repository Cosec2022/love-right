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

const traits = [
  ["security", "依恋安全"], ["spark", "心动强度"], ["idealism", "浪漫理想"],
  ["reassurance", "确认需求"], ["autonomy", "边界独立"], ["commitment", "长期投入"],
  ["directness", "沟通直接"], ["care", "照顾投入"], ["discernment", "识人谨慎"],
  ["novelty", "新鲜偏好"], ["validation", "公开认可"], ["repair", "关系修复"]
].map(([id, label]) => ({ id, label }));

const story = {
  schemaVersion: 1,
  id: slugArg,
  slug: slugArg,
  status: "draft",
  locale: "zh-CN",
  metadata: {
    series: "LOVE RIGHT · DRAFT",
    title,
    subtitle: "在这里填写一句能够让用户立刻进入情境的开场。",
    description: "在这里填写故事库卡片说明。",
    coverTheme: "night-rose",
    estimatedMinutes: 8,
    tags: ["互动剧情", "恋爱投射", "多结局"],
    disclaimer: "娱乐性叙事情境投射，不是心理诊断、事实识别或未来预言。"
  },
  traits,
  scoreConfig: { center: 50, spread: 42, min: 8, max: 92 },
  initialScene: "s01_opening",
  scenes: [
    {
      id: "s01_opening", slot: 1, chapter: "01 · 故事开始",
      content: [{ type: "paragraph", text: "把第一幕写在这里。每个选择都必须真正改变后续关系或评分。" }],
      prompt: "你会：", note: "这一幕主要测量什么？",
      choices: [
        { id: "a", text: "主动靠近", effects: { spark: 2, directness: 1 }, next: "s02_response" },
        { id: "b", text: "先观察一下", effects: { discernment: 2, autonomy: 1 }, next: "s02_response" }
      ]
    },
    {
      id: "s02_response", slot: 2, chapter: "02 · 对方的回应",
      content: [{ type: "paragraph", text: "让上一幕的选择在人物行为中留下痕迹。" }],
      prompt: "你更在意：", note: "不要写成四个同义答案。",
      choices: [
        { id: "a", text: "对方是否明确", effects: { reassurance: 2, validation: 1 }, next: "s03_decision" },
        { id: "b", text: "对方是否尊重边界", effects: { autonomy: 2, security: 1 }, next: "s03_decision" }
      ]
    },
    {
      id: "s03_decision", slot: 3, chapter: "03 · 你的决定",
      content: [{ type: "paragraph", text: "用一个可分享的选择结束这个最小样例。正式故事建议 14—22 个测量槽位。" }],
      prompt: "最后，你会：", note: "终局选择需要设置 outcome。",
      choices: [
        { id: "a", text: "走向对方", effects: { commitment: 2 }, outcome: "approach", next: "$result" },
        { id: "b", text: "保留自己的节奏", effects: { autonomy: 2 }, outcome: "pause", next: "$result" }
      ]
    }
  ]
};

const results = {
  schemaVersion: 1,
  storyId: slugArg,
  meters: [
    { id: "closeness", label: "靠近方式", components: [{ trait: "spark" }, { trait: "commitment" }] },
    { id: "boundary", label: "关系边界", components: [{ trait: "autonomy" }, { trait: "discernment" }] }
  ],
  archetypes: [
    { id: "open", title: "愿意靠近的人", tagline: "你允许心动发生，也希望选择最终落到行动。", target: { spark: 70, commitment: 65 }, tags: ["回应明确", "尊重边界"] },
    { id: "observe", title: "清醒观察的人", tagline: "你不会拒绝爱，但会先确认它是否安全。", target: { discernment: 75, autonomy: 70 }, tags: ["稳定可靠", "行动一致"] }
  ],
  sections: {
    ending: {
      byOutcome: { approach: "你决定向前一步。", pause: "你决定保留自己的节奏。" },
      appendRules: [{ default: true, text: "真正重要的是，这一步由你自己决定。" }]
    },
    psychology: {
      byArchetype: { open: "你愿意让关系通过行动得到确认。", observe: "你需要事实慢慢建立信任。" },
      appendRules: [{ default: true, text: "这只是故事中的投射，不是固定标签。" }]
    },
    history: { groups: [[{ default: true, text: "这里填写基于选择生成的过去模式推演。" }]] },
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
  coverTheme: "night-rose",
  storyUrl: `./stories/${slugArg}/story.json`,
  resultsUrl: `./stories/${slugArg}/results.json`
});
await writeFile(catalogFile, JSON.stringify(catalog, null, 2) + "\n");

console.log(`Created draft story package: public/stories/${slugArg}`);
console.log("Next: edit story.json and results.json, then run npm run check.");
