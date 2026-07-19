import { StoryEngine } from "./engine/story-engine.js";
import { ScoreEngine } from "./engine/score-engine.js";
import { ResultEngine } from "./engine/result-engine.js";
import { SessionStore } from "./engine/session-store.js";
import { AnalyticsClient } from "./engine/analytics-client.js";
import { Renderer } from "./ui/renderer.js";
import { createRequestGate } from "./request-gate.js";
import { CommercialController } from "./commercial/commercial-controller.js";
import { selectFourCharacterLabel } from "./commercial/label-engine.js";

const REQUIRED_DOM_IDS = [
  "brandBtn", "libraryBtn", "accountBtn", "libraryScreen", "storyList", "filterAll", "filterFemale", "filterMale",
  "startScreen", "startBtn", "resetProgressBtn", "storySeries", "storyTitle", "storySubtitle", "storyTitleMini", "storyTags", "startNote",
  "quizScreen", "progressBar", "progressText", "chapter", "sceneCopy", "question", "sceneNote", "options", "backBtn", "decisionBanner", "decisionLabel", "decisionNote",
  "revealScreen", "revealEyebrow", "revealStoryTitle", "revealTitle", "revealCopy", "revealContinueBtn",
  "resultScreen", "resultTitle", "resultTagline", "resultLabel", "endingStoryTitle", "endingCopy", "contradictionTitle", "contradictionCopy", "insightGrid", "emotionIndexGrid", "moveList", "evidenceList", "psychologyCopy", "historyCopy", "futureGrid", "matchTags", "matchCopy", "warningCopy", "traitGrid", "restartBtn", "shareBtn", "commercialResultPanel", "resultFooter",
  "errorScreen", "errorMessage", "errorRecoveryBtn", "toast"
];

const missingDomIds = (root = document) => REQUIRED_DOM_IDS.filter((id) => !root.getElementById(id));

let renderer;
let store;
let analytics;
let commercial;

let catalog = null;
let currentEntry = null;
let story = null;
let engine = null;
let resultEngine = null;
let latestResult = null;
let latestLabel = null;
let selectedAudience = "all";
let catalogPromise = null;
const storyRequests = createRequestGate();

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

function showBuiltResult(result) {
  latestResult = result;
  latestLabel = selectFourCharacterLabel(result);
  renderer.renderResult(result, story, latestLabel);
  commercial?.presentResult({ result, label: latestLabel, story: currentEntry });
}

function renderCurrentResult() {
  showBuiltResult(resultEngine.build(engine.state));
}

async function openStory(entry, { pushUrl = true } = {}) {
  const loadVersion = storyRequests.begin();
  try {
    const [loadedStory, results] = await Promise.all([
      fetchJson(storyUrl(entry, "storyUrl")),
      fetchJson(storyUrl(entry, "resultsUrl"))
    ]);
    if (!storyRequests.isCurrent(loadVersion)) return;
    if (loadedStory.id !== entry.id) throw new Error("故事目录与内容包 ID 不一致。运行 npm run validate 检查内容。 ");
    if (results.storyId !== loadedStory.id) throw new Error("结果包与故事内容包不匹配。运行 npm run validate 检查内容。 ");

    currentEntry = entry;
    story = loadedStory;
    const scoreEngine = new ScoreEngine(story);
    resultEngine = new ResultEngine(story, results, scoreEngine);
    engine = new StoryEngine(story, {
      store,
      onEvent: (type, payload) => analytics.track(type, payload)
    });
    latestResult = null;
    latestLabel = null;
    commercial?.clearResult();
    renderer.renderStart(story, engine.state);
    if (pushUrl) updateUrl(entry);
  } catch (error) {
    if (!storyRequests.isCurrent(loadVersion)) return;
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
        renderer.renderReveal({ story, choice, result: latestResult }, () => showBuiltResult(latestResult));
      } else {
        showBuiltResult(latestResult);
      }
    } else renderCurrentScene();
  } catch (error) {
    console.error(error);
    renderer.error(`故事引擎遇到错误：${error.message}`);
  }
}

async function showLibrary({ pushUrl = true } = {}) {
  if (!catalog) return;
  storyRequests.begin();
  currentEntry = null;
  story = null;
  engine = null;
  resultEngine = null;
  latestResult = null;
  latestLabel = null;
  commercial?.clearResult();
  const rankedCatalog = commercial?.rankCatalog(catalog) ?? catalog;
  renderer.renderCatalog(rankedCatalog, selectedAudience, (entry) => openStory(entry));
  document.title = "Love Right｜CosecLab";
  if (pushUrl) updateUrl(null);
}

async function copyResult() {
  if (!latestResult) return;
  const text = [
    `我在 Love Right《${story.metadata.title}》里得到「${latestLabel?.title ?? latestResult.memory.title}」`,
    latestLabel?.hook ?? latestResult.memory.hook,
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
    catalogPromise ??= fetchJson(new URL("../stories/catalog.json", import.meta.url));
    catalog = await catalogPromise;
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

function bindEvents() {
document.getElementById("startBtn").addEventListener("click", () => {
  if (!engine) return;
  if (engine.state.complete) renderCurrentResult();
  else {
    engine.start();
    renderCurrentScene();
  }
});

document.getElementById("resetProgressBtn").addEventListener("click", () => {
  engine?.reset();
  if (engine) renderer.renderStart(story, engine.state);
});

document.getElementById("backBtn").addEventListener("click", () => {
  if (engine?.back()) renderCurrentScene();
});

document.getElementById("restartBtn").addEventListener("click", () => {
  engine?.reset();
  if (engine) renderer.renderStart(story, engine.state);
});

document.getElementById("shareBtn").addEventListener("click", copyResult);
document.getElementById("libraryBtn").addEventListener("click", () => showLibrary());
document.getElementById("brandBtn").addEventListener("click", () => showLibrary());
document.getElementById("errorRecoveryBtn").addEventListener("click", () => {
  if (catalog) showLibrary({ pushUrl: false });
  else {
    catalogPromise = null;
    bootstrap();
  }
});
for (const id of ["filterAll", "filterFemale", "filterMale"]) {
  document.getElementById(id).addEventListener("click", (event) => {
    selectedAudience = event.currentTarget.dataset.audience;
    showLibrary({ pushUrl: false });
  });
}

window.addEventListener("popstate", async () => {
  const requested = new URL(location.href).searchParams.get("story");
  const entry = requested ? catalog?.stories.find((item) => item.slug === requested || item.id === requested) : null;
  if (entry) await openStory(entry, { pushUrl: false });
  else await showLibrary({ pushUrl: false });
});
}

async function start() {
  const missing = missingDomIds();
  if (missing.length) {
    const error = document.getElementById("errorMessage");
    if (error) error.textContent = `应用页面不完整，缺少必要节点：${missing.join("、")}`;
    document.getElementById("errorScreen")?.classList.add("active");
    return;
  }
  renderer = new Renderer();
  store = new SessionStore();
  analytics = new AnalyticsClient({
    endpoint: globalThis.LOVE_RIGHT_ANALYTICS_ENDPOINT ?? null,
    consent: localStorage.getItem("love-right:analytics-consent") === "granted"
  });
  commercial = new CommercialController({
    accountButton: document.getElementById("accountBtn"),
    resultPanel: document.getElementById("commercialResultPanel"),
    notify: (message) => renderer.toast(message),
    onRankingChange: () => {
      if (catalog && !currentEntry) showLibrary({ pushUrl: false });
    }
  });
  bindEvents();
  await commercial.init();
  await bootstrap();
}

// Start only after this module has finished binding all static controls.
Promise.resolve()
  .then(start)
  .catch((error) => {
    console.error("Love Right bootstrap failed:", error);
  });

export { REQUIRED_DOM_IDS, missingDomIds };
