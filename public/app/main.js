import { StoryEngine } from "./engine/story-engine.js";
import { ScoreEngine } from "./engine/score-engine.js";
import { ResultEngine } from "./engine/result-engine.js";
import { SessionStore } from "./engine/session-store.js";
import { AnalyticsClient } from "./engine/analytics-client.js";
import { Renderer } from "./ui/renderer.js";

const renderer = new Renderer();
const store = new SessionStore();
const analytics = new AnalyticsClient({
  endpoint: globalThis.LOVE_RIGHT_ANALYTICS_ENDPOINT ?? null,
  consent: localStorage.getItem("love-right:analytics-consent") === "granted"
});

let catalog = null;
let currentEntry = null;
let story = null;
let engine = null;
let resultEngine = null;
let latestResult = null;

const fetchJson = async (url) => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`无法载入 ${url}（${response.status}）`);
  return response.json();
};

const storyUrl = (entry, field) => new URL(entry[field], document.baseURI).toString();

function updateUrl(entry = null) {
  const url = new URL(location.href);
  if (entry) url.searchParams.set("story", entry.slug);
  else url.searchParams.delete("story");
  history.pushState({ story: entry?.slug ?? null }, "", url);
}

function renderCurrentScene() {
  renderer.renderScene(
    engine.getCurrentScene(),
    engine.getProgress(),
    engine.state.history.length > 0,
    handleChoice
  );
}

function renderCurrentResult() {
  latestResult = resultEngine.build(engine.state);
  renderer.renderResult(latestResult, story);
}

async function openStory(entry, { pushUrl = true } = {}) {
  try {
    currentEntry = entry;
    const [loadedStory, results] = await Promise.all([
      fetchJson(storyUrl(entry, "storyUrl")),
      fetchJson(storyUrl(entry, "resultsUrl"))
    ]);
    if (loadedStory.id !== entry.id) throw new Error("故事目录与内容包 ID 不一致。运行 npm run validate 检查内容。 ");
    if (results.storyId !== loadedStory.id) throw new Error("结果包与故事内容包不匹配。运行 npm run validate 检查内容。 ");

    story = loadedStory;
    const scoreEngine = new ScoreEngine(story);
    resultEngine = new ResultEngine(story, results, scoreEngine);
    engine = new StoryEngine(story, {
      store,
      onEvent: (type, payload) => analytics.track(type, payload)
    });
    latestResult = null;
    renderer.renderStart(story, engine.state);
    if (pushUrl) updateUrl(entry);
  } catch (error) {
    console.error(error);
    renderer.error(`${error.message}\n\n请通过 npm run dev 打开项目；直接使用 file:// 可能无法载入故事内容包。`);
  }
}

function handleChoice(choiceId) {
  try {
    const scene = engine.getCurrentScene();
    const choice = scene.choices.find((item) => item.id === choiceId);
    engine.choose(choiceId);
    if (engine.state.complete) {
      latestResult = resultEngine.build(engine.state);
      if (scene.decisionType === "final" && choice?.finalReveal) {
        renderer.renderReveal({ story, choice, result: latestResult }, () => renderer.renderResult(latestResult, story));
      } else {
        renderer.renderResult(latestResult, story);
      }
    } else renderCurrentScene();
  } catch (error) {
    console.error(error);
    renderer.error(`故事引擎遇到错误：${error.message}`);
  }
}

async function showLibrary({ pushUrl = true } = {}) {
  if (!catalog) return;
  currentEntry = null;
  story = null;
  engine = null;
  resultEngine = null;
  latestResult = null;
  renderer.renderCatalog(catalog, (entry) => openStory(entry));
  document.title = "Love Right｜CosecLab";
  if (pushUrl) updateUrl(null);
}

async function copyResult() {
  if (!latestResult) return;
  const text = [
    `我在 Love Right《${story.metadata.title}》里是「${latestResult.memory.title}」`,
    latestResult.memory.hook,
    "",
    `最矛盾：${latestResult.memory.contradiction.text}`,
    `会被打动：${latestResult.memory.insights[0]?.text ?? ""}`,
    `适合的人：${latestResult.memory.insights[2]?.text ?? ""}`,
    "",
    "娱乐性叙事情境投射，不是心理诊断或未来预言。"
  ].join("\n");

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  renderer.toast("结果已复制");
}

async function bootstrap() {
  try {
    catalog = await fetchJson(new URL("../stories/catalog.json", import.meta.url));
    const requested = new URL(location.href).searchParams.get("story");
    const entry = requested
      ? catalog.stories.find((item) => item.slug === requested || item.id === requested)
      : null;
    if (entry) await openStory(entry, { pushUrl: false });
    else await showLibrary({ pushUrl: false });
  } catch (error) {
    console.error(error);
    renderer.error(`${error.message}\n\n请在项目目录运行 npm install && npm run dev。`);
  }
}

void bootstrap(); document.getElementById("startBtn")?.addEventListener("click", () => {
  if (!engine) return;
  if (engine.state.complete) renderCurrentResult();
  else {
    engine.start();
    renderCurrentScene();
  }
});

document.getElementById("resetProgressBtn")?.addEventListener("click", () => {
  engine?.reset();
  if (engine) renderer.renderStart(story, engine.state);
});

document.getElementById("backBtn")?.addEventListener("click", () => {
  if (engine?.back()) renderCurrentScene();
});

document.getElementById("restartBtn")?.addEventListener("click", () => {
  engine?.reset();
  if (engine) renderer.renderStart(story, engine.state);
});

document.getElementById("shareBtn")?.addEventListener("click", copyResult);
document.getElementById("libraryBtn")?.addEventListener("click", () => showLibrary());
document.getElementById("brandBtn")?.addEventListener("click", () => showLibrary());

window.addEventListener("popstate", async () => {
  const requested = new URL(location.href).searchParams.get("story");
  const entry = requested ? catalog?.stories.find((item) => item.slug === requested || item.id === requested) : null;
  if (entry) await openStory(entry, { pushUrl: false });
  else await showLibrary({ pushUrl: false });
});
