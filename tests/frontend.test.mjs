import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { publishedStories, storiesForAudience } from "../public/app/ui/renderer.js";
import { createRequestGate } from "../public/app/request-gate.js";
import { verifyModuleEntrypoint } from "../scripts/static-helpers.mjs";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const catalog = JSON.parse(await read("public/stories/catalog.json"));

test("library has ten published stories and audience filters are deterministic", () => {
  assert.equal(publishedStories(catalog).length, 10);
  assert.equal(storiesForAudience(catalog, "all").length, 10);
  assert.equal(storiesForAudience(catalog, "female").length, 6);
  assert.equal(storiesForAudience(catalog, "male").length, 4);
});

test("the sole versioned module entry is accepted and duplicate entries are rejected", () => {
  assert.doesNotThrow(() => verifyModuleEntrypoint('<script type="module" src="./app/main.js?v=42"></script>'));
  assert.throws(() => verifyModuleEntrypoint('<script type="module" src="./app/main.js"></script><script type="module" src="./app/main.js?v=42"></script>'));
});

test("old story responses cannot become current after a newer request", () => {
  const gate = createRequestGate();
  const oldRequest = gate.begin();
  const newRequest = gate.begin();
  assert.equal(gate.isCurrent(oldRequest), false);
  assert.equal(gate.isCurrent(newRequest), true);
});

test("homepage has one formal renderer and no business UI observers or text lookup", async () => {
  const [html, main, renderer, badges, enhancements] = await Promise.all([
    read("public/index.html"), read("public/app/main.js"), read("public/app/ui/renderer.js"),
    read("public/app/ui/content-badges.js").catch(() => ""), read("public/app/ui/homepage-enhancements.js").catch(() => "")
  ]);
  assert.equal((html.match(/app\/main\.js/g) ?? []).length, 1);
  assert.equal(badges + enhancements, "");
  assert.doesNotMatch(main + renderer, /MutationObserver/);
  assert.doesNotMatch(main + renderer, /querySelector[^\n]*(禁忌之恋|女性向|男性向|空间结果)/);
  assert.match(renderer, /entry-meta/);
  assert.doesNotMatch(renderer, /高"\s*:|低"\s*:|中"\s*:/);
});

test("bootstrap validates required DOM before binding controls", async () => {
  const main = await read("public/app/main.js");
  assert.match(main, /REQUIRED_DOM_IDS/);
  assert.match(main, /应用页面不完整，缺少必要节点/);
  assert.match(main, /bindEvents\(\);\s*bootstrap\(\)/);
});
