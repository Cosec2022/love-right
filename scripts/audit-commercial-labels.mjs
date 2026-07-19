import { readFile } from "node:fs/promises";
import { ScoreEngine } from "../public/app/engine/score-engine.js";
import { ResultEngine } from "../public/app/engine/result-engine.js";
import { resolveConditionalTarget } from "../public/app/engine/condition-evaluator.js";
import { selectFourCharacterLabel, FOUR_CHARACTER_LABELS } from "../public/app/commercial/label-engine.js";

const catalog = JSON.parse(await readFile(new URL("../public/stories/catalog.json", import.meta.url), "utf8"));
const counts = Object.fromEntries(FOUR_CHARACTER_LABELS.map((item) => [item.id, 0]));
const runs = Number(process.env.COMMERCIAL_AUDIT_RUNS ?? 600);

function randomRun(story) {
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
    const choice = scene.choices[Math.floor(Math.random() * scene.choices.length)];
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
    throw new Error(`${story.id}: random route failed after ${state.answers.length} answers`);
  }
  return state;
}

for (const entry of catalog.stories.filter((item) => item.status === "published")) {
  const story = JSON.parse(await readFile(new URL(`../public/${entry.storyUrl.replace(/^\.\//, "")}`, import.meta.url), "utf8"));
  const results = JSON.parse(await readFile(new URL(`../public/${entry.resultsUrl.replace(/^\.\//, "")}`, import.meta.url), "utf8"));
  const resultEngine = new ResultEngine(story, results, new ScoreEngine(story));
  for (let index = 0; index < runs; index += 1) {
    const result = resultEngine.build(randomRun(story));
    counts[selectFourCharacterLabel(result).id] += 1;
  }
}

const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
const rows = Object.entries(counts)
  .map(([id, count]) => ({ id, count, share: count / total }))
  .sort((a, b) => b.count - a.count);
console.table(rows.map((item) => ({ label: item.id, share: `${(item.share * 100).toFixed(2)}%`, count: item.count })));
const missing = rows.filter((item) => item.count === 0);
const max = rows[0]?.share ?? 1;
if (missing.length || max > 0.16) {
  throw new Error(`Commercial label audit failed: missing=${missing.map((item) => item.id).join(",") || "none"}, max=${(max * 100).toFixed(2)}%`);
}
console.log(`Commercial label audit passed: 16/16 reachable, max ${(max * 100).toFixed(2)}%.`);
