import { readFile, access } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const publicDir = path.join(root, "public");
const html = await readFile(path.join(publicDir, "index.html"), "utf8");
const renderer = await readFile(path.join(publicDir, "app", "ui", "renderer.js"), "utf8");
const main = await readFile(path.join(publicDir, "app", "main.js"), "utf8");

const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
const referenced = new Set([
  ...renderer.matchAll(/el\("([^"]+)"\)/g),
  ...main.matchAll(/getElementById\("([^"]+)"\)/g)
].map((match) => match[1]));
const missing = [...referenced].filter((id) => !ids.has(id));
if (missing.length) {
  console.error(`Missing DOM IDs: ${missing.join(", ")}`);
  process.exit(1);
}

for (const file of [
  "app.css",
  "app/main.js",
  "app/engine/story-engine.js",
  "app/engine/score-engine.js",
  "app/engine/result-engine.js",
  "app/engine/result-compressor.js",
  "app/ui/renderer.js",
  "stories/catalog.json"
]) await access(path.join(publicDir, file));

if (html.includes("你的心动参数") || html.includes('id="meterGrid"')) {
  console.error("Legacy parameter grid is still exposed in the primary result page.");
  process.exit(1);
}

if (!html.includes('id="endingStoryTitle"') || !html.includes('id="endingCopy"') || !html.includes('id="contradictionCopy"') || !html.includes('id="insightGrid"') || !html.includes('id="emotionIndexGrid"') || !html.includes('id="moveList"')) {
  console.error("Result page sections are missing.");
  process.exit(1);
}

if (html.indexOf('id="endingCopy"') > html.indexOf('id="contradictionCopy"')) {
  console.error("Story ending must appear before the psychological interpretation.");
  process.exit(1);
}

if (!html.includes('type="module" src="./app/main.js"')) {
  console.error("index.html does not load the application module.");
  process.exit(1);
}

console.log(`Love Right static shell passed: ${ids.size} DOM IDs, ${referenced.size} referenced.`);
