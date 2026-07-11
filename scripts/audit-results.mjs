import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ScoreEngine } from "../public/app/engine/score-engine.js";
import { ResultEngine } from "../public/app/engine/result-engine.js";
import { resolveConditionalTarget } from "../public/app/engine/condition-evaluator.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const catalog = JSON.parse(await readFile(path.join(publicDir, "stories/catalog.json"), "utf8"));
const RUNS = Number(process.env.AUDIT_RUNS ?? 16000);

const pick = (array) => array[Math.floor(Math.random() * array.length)];

function runRoute(story, pickChoice) {
  const scenes = new Map(story.scenes.map((scene) => [scene.id, scene]));
  const state = {
    currentSceneId: story.initialScene,
    answers: [],
    flags: {},
    visited: [story.initialScene],
    outcome: null,
    complete: false
  };
  let guard = 0;
  while (!state.complete && guard < 40) {
    const scene = scenes.get(state.currentSceneId);
    if (!scene) throw new Error(`${story.id}: missing scene ${state.currentSceneId}`);
    const choice = pickChoice(scene, guard);
    const answer = {
      sceneId: scene.id,
      slot: scene.slot,
      chapter: scene.chapter,
      choiceId: choice.id,
      choiceText: choice.text,
      vector: structuredClone(choice.vector ?? choice.effects ?? {}),
      context: choice.context ?? scene.context ?? "general",
      intensity: choice.intensity ?? 1,
      confidence: choice.confidence ?? 1,
      cross: structuredClone(choice.cross ?? []),
      effects: structuredClone(choice.effects ?? choice.vector ?? {}),
      outcome: choice.outcome ?? null
    };
    state.answers.push(answer);
    Object.assign(state.flags, choice.setFlags ?? {});
    for (const flag of choice.unsetFlags ?? []) delete state.flags[flag];
    if (choice.outcome) state.outcome = choice.outcome;
    const target = resolveConditionalTarget(choice.next ?? scene.next, {
      flags: state.flags,
      answers: state.answers,
      outcome: state.outcome,
      visited: state.visited
    });
    if (target === "$result") state.complete = true;
    else {
      state.currentSceneId = target;
      state.visited.push(target);
    }
    guard += 1;
  }
  if (!state.complete || state.answers.length !== 18) {
    throw new Error(`${story.id}: route failed (${state.answers.length})`);
  }
  return state;
}

const runRandom = (story) => runRoute(story, (scene) => pick(scene.choices));
const runPattern = (story, index) => runRoute(story, (scene) => scene.choices[Math.min(index, scene.choices.length - 1)]);

const report = { generatedAt: new Date().toISOString(), runsPerStory: RUNS, stories: {} };
let failed = false;
for (const entry of catalog.stories.filter((item) => item.status === "published")) {
  const story = JSON.parse(await readFile(path.join(publicDir, entry.storyUrl.replace(/^\.\//, "")), "utf8"));
  const results = JSON.parse(await readFile(path.join(publicDir, entry.resultsUrl.replace(/^\.\//, "")), "utf8"));
  const scorer = new ScoreEngine(story);
  const resultEngine = new ResultEngine(story, results, scorer);
  const counts = Object.fromEntries(results.archetypes.map((item) => [item.id, 0]));
  const margins = [];
  let blends = 0;
  const samples = [];

  for (let index = 0; index < RUNS; index += 1) {
    const state = runRandom(story);
    const result = resultEngine.build(state);
    counts[result.archetype.id] += 1;
    margins.push(result.archetype.margin ?? 0);
    if (result.archetype.secondary) blends += 1;
    if (index < 3) {
      samples.push({
        archetype: result.archetype.id,
        secondary: result.archetype.secondary?.id ?? null,
        outcome: result.outcome,
        traits: result.traits
      });
    }
  }

  const deterministic = [0, 1, 2, 3].map((choiceIndex) => {
    const result = resultEngine.build(runPattern(story, choiceIndex));
    return {
      pattern: String.fromCharCode(65 + choiceIndex),
      archetype: result.archetype.id,
      secondary: result.archetype.secondary?.id ?? null,
      outcome: result.outcome
    };
  });

  const distribution = Object.fromEntries(Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => [id, Number((count / RUNS * 100).toFixed(2))]));
  const values = Object.values(distribution);
  const maxShare = Math.max(...values);
  const minShare = Math.min(...values);
  const unique = values.filter((value) => value > 0).length;
  const meanMargin = margins.reduce((sum, value) => sum + value, 0) / margins.length;
  const blendRate = Number((blends / RUNS * 100).toFixed(2));
  const deterministicUnique = new Set(deterministic.map((item) => item.archetype)).size;

  const checks = {
    distributionBalanced: maxShare <= 30 && minShare >= 5,
    noDeadArchetypes: unique === results.archetypes.length,
    blendRateHealthy: blendRate >= 12 && blendRate <= 55,
    deterministicDiversity: deterministicUnique >= 3
  };
  const pass = Object.values(checks).every(Boolean);
  if (!pass) failed = true;

  report.stories[story.id] = {
    title: story.metadata.title,
    distribution,
    maxShare,
    minShare,
    unique,
    meanMargin: Number(meanMargin.toFixed(4)),
    blendRate,
    deterministic,
    checks,
    pass,
    samples
  };

  console.log(`\n${story.id} · ${story.metadata.title}`);
  console.table(distribution);
  console.table(deterministic);
  console.log(`max=${maxShare}% min=${minShare}% unique=${unique}/${results.archetypes.length} blend=${blendRate}% deterministic=${deterministicUnique}/4 meanMargin=${meanMargin.toFixed(4)} ${pass ? "PASS" : "FAIL"}`);
}

await mkdir(path.join(root, "docs/generated"), { recursive: true });
await writeFile(path.join(root, "docs/generated/result-distribution.json"), JSON.stringify(report, null, 2) + "\n");
if (failed) {
  console.error("\nResult audit failed. Tune vectors, archetype centers, blending or story choices before release.");
  process.exit(1);
}
console.log("\nResult distribution, blend rate and deterministic route audit passed for all published stories.");
