import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const storyId = process.argv[2] ?? "story-01";
const root = path.resolve(new URL("..", import.meta.url).pathname);
const catalog = JSON.parse(await readFile(path.join(root, "public", "stories", "catalog.json"), "utf8"));
const entry = catalog.stories.find((item) => item.id === storyId || item.slug === storyId);
if (!entry) {
  console.error(`Unknown story '${storyId}'.`);
  process.exit(1);
}
const story = JSON.parse(await readFile(path.join(root, "public", entry.storyUrl.replace(/^\.\//, "")), "utf8"));

const targets = (next) => {
  if (typeof next === "string") return [next];
  if (!next) return [];
  return [...(next.cases ?? []).map((item) => item.to), next.default].filter(Boolean);
};
const safe = (value) => value.replace(/[^a-zA-Z0-9_]/g, "_");
const lines = ["flowchart TD", `  START([Start]) --> ${safe(story.initialScene)}`];
const edges = new Set();
for (const scene of story.scenes) {
  const node = safe(scene.id);
  lines.push(`  ${node}["${scene.chapter.replace(/"/g, "'")}"]`);
  for (const choice of scene.choices) {
    for (const target of targets(choice.next ?? scene.next)) {
      const targetNode = target === "$result" ? "RESULT([Result])" : safe(target);
      const key = `${node}|${choice.id}|${target}`;
      if (edges.has(key)) continue;
      edges.add(key);
      lines.push(`  ${node} -- "${choice.id.toUpperCase()}" --> ${targetNode}`);
    }
  }
}
const outDir = path.join(root, "docs", "generated");
await mkdir(outDir, { recursive: true });
const output = path.join(outDir, `${story.id}.mmd`);
await writeFile(output, lines.join("\n") + "\n");
console.log(`Wrote ${path.relative(root, output)} (${story.scenes.length} scenes).`);
