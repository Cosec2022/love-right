import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const publicDir = path.join(root, "public");
const errors = [];
const warnings = [];

const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));

function targetsFrom(next) {
  if (!next) return [];
  if (typeof next === "string") return [next];
  return [...(next.cases ?? []).map((item) => item.to), next.default].filter(Boolean);
}

function validateCondition(condition, traits, where) {
  if (!condition || condition.default === true) return;
  for (const key of ["all", "any"]) {
    if (condition[key]) condition[key].forEach((item, index) => validateCondition(item, traits, `${where}.${key}[${index}]`));
  }
  if (condition.not) validateCondition(condition.not, traits, `${where}.not`);
  if (condition.trait && !traits.has(condition.trait)) fail(`${where}: unknown trait '${condition.trait}'.`);
  if (condition.rawTrait && !traits.has(condition.rawTrait)) fail(`${where}: unknown raw trait '${condition.rawTrait}'.`);
}

function validateRules(rules, traits, where) {
  for (const [index, rule] of (rules ?? []).entries()) {
    if (!rule.text) fail(`${where}[${index}] is missing text.`);
    if (!rule.default) validateCondition(rule.when, traits, `${where}[${index}].when`);
  }
}

async function validateStory(entry) {
  const storyFile = path.join(publicDir, entry.storyUrl.replace(/^\.\//, ""));
  const resultsFile = path.join(publicDir, entry.resultsUrl.replace(/^\.\//, ""));
  let story;
  let results;
  try { story = await readJson(storyFile); } catch (error) { fail(`${entry.id}: cannot read story file: ${error.message}`); return; }
  try { results = await readJson(resultsFile); } catch (error) { fail(`${entry.id}: cannot read results file: ${error.message}`); return; }

  if (story.id !== entry.id) fail(`${entry.id}: catalog/story ID mismatch (${story.id}).`);
  if (results.storyId !== story.id) fail(`${entry.id}: results.storyId mismatch (${results.storyId}).`);
  if (!story.metadata?.title) fail(`${entry.id}: metadata.title is required.`);
  if (!Array.isArray(story.scenes) || !story.scenes.length) fail(`${entry.id}: scenes must be a non-empty array.`);
  if (!Array.isArray(story.traits) || !story.traits.length) fail(`${entry.id}: traits must be a non-empty array.`);

  const traitIds = new Set();
  for (const trait of story.traits ?? []) {
    if (!trait.id || !trait.label) fail(`${entry.id}: every trait needs id and label.`);
    if (traitIds.has(trait.id)) fail(`${entry.id}: duplicate trait '${trait.id}'.`);
    traitIds.add(trait.id);
  }

  const sceneIds = new Set();
  const slots = new Set();
  for (const scene of story.scenes ?? []) {
    if (!scene.id) fail(`${entry.id}: scene without id.`);
    if (sceneIds.has(scene.id)) fail(`${entry.id}: duplicate scene '${scene.id}'.`);
    sceneIds.add(scene.id);
    if (!Number.isInteger(scene.slot) || scene.slot < 1) fail(`${entry.id}/${scene.id}: slot must be a positive integer.`);
    slots.add(scene.slot);
    if (!scene.chapter || !scene.prompt) fail(`${entry.id}/${scene.id}: chapter and prompt are required.`);
    if (!Array.isArray(scene.content) || !scene.content.length) fail(`${entry.id}/${scene.id}: content must not be empty.`);
    if (!Array.isArray(scene.choices) || scene.choices.length < 2) fail(`${entry.id}/${scene.id}: at least two choices are required.`);
    const choiceIds = new Set();
    for (const choice of scene.choices ?? []) {
      if (!choice.id || !choice.text) fail(`${entry.id}/${scene.id}: every choice needs id and text.`);
      if (choiceIds.has(choice.id)) fail(`${entry.id}/${scene.id}: duplicate choice '${choice.id}'.`);
      choiceIds.add(choice.id);
      for (const [traitId, value] of Object.entries(choice.effects ?? {})) {
        if (!traitIds.has(traitId)) fail(`${entry.id}/${scene.id}/${choice.id}: unknown trait '${traitId}'.`);
        if (typeof value !== "number" || !Number.isFinite(value)) fail(`${entry.id}/${scene.id}/${choice.id}: effect '${traitId}' must be numeric.`);
        if (Math.abs(value) > 5) warn(`${entry.id}/${scene.id}/${choice.id}: unusually large effect ${traitId}=${value}.`);
      }
    }
  }

  if (!sceneIds.has(story.initialScene)) fail(`${entry.id}: initialScene '${story.initialScene}' does not exist.`);
  const maxSlot = Math.max(...slots);
  for (let slot = 1; slot <= maxSlot; slot += 1) if (!slots.has(slot)) fail(`${entry.id}: assessment slot ${slot} is missing.`);

  const adjacency = new Map();
  for (const scene of story.scenes ?? []) {
    const targets = new Set();
    for (const choice of scene.choices ?? []) {
      const next = choice.next ?? scene.next;
      if (!next) fail(`${entry.id}/${scene.id}/${choice.id}: no next target.`);
      for (const target of targetsFrom(next)) {
        if (target !== "$result" && !sceneIds.has(target)) fail(`${entry.id}/${scene.id}/${choice.id}: target '${target}' does not exist.`);
        targets.add(target);
      }
      if (typeof next === "object") {
        for (const [index, item] of (next.cases ?? []).entries()) {
          validateCondition(item.when, traitIds, `${entry.id}/${scene.id}/${choice.id}.next.cases[${index}].when`);
        }
      }
    }
    adjacency.set(scene.id, [...targets]);
  }

  const terminalOutcomes = new Set();
  for (const scene of story.scenes ?? []) {
    for (const choice of scene.choices ?? []) {
      const targets = targetsFrom(choice.next ?? scene.next);
      if (targets.includes("$result")) {
        if (!choice.outcome) fail(`${entry.id}/${scene.id}/${choice.id}: terminal choice must declare outcome.`);
        else terminalOutcomes.add(choice.outcome);
      }
    }
  }

  const reachable = new Set();
  const stack = [story.initialScene];
  while (stack.length) {
    const current = stack.pop();
    if (current === "$result" || reachable.has(current)) continue;
    reachable.add(current);
    for (const target of adjacency.get(current) ?? []) stack.push(target);
  }
  for (const sceneId of sceneIds) if (!reachable.has(sceneId)) fail(`${entry.id}: scene '${sceneId}' is unreachable.`);

  const colors = new Map();
  const visitForCycle = (sceneId, trail = []) => {
    if (sceneId === "$result") return;
    if (colors.get(sceneId) === 1) {
      fail(`${entry.id}: cycle detected: ${[...trail, sceneId].join(" -> ")}.`);
      return;
    }
    if (colors.get(sceneId) === 2) return;
    colors.set(sceneId, 1);
    for (const target of adjacency.get(sceneId) ?? []) visitForCycle(target, [...trail, sceneId]);
    colors.set(sceneId, 2);
  };
  visitForCycle(story.initialScene);

  const canTerminate = new Set(["$result"]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [sceneId, targets] of adjacency) {
      if (!canTerminate.has(sceneId) && targets.some((target) => canTerminate.has(target))) {
        canTerminate.add(sceneId);
        changed = true;
      }
    }
  }
  for (const sceneId of reachable) if (!canTerminate.has(sceneId)) fail(`${entry.id}: scene '${sceneId}' cannot reach a result.`);

  for (const meter of results.meters ?? []) {
    if (!meter.id || !meter.label || !meter.components?.length) fail(`${entry.id}: malformed meter '${meter.id ?? "unknown"}'.`);
    for (const component of meter.components ?? []) if (!traitIds.has(component.trait)) fail(`${entry.id}/meter/${meter.id}: unknown trait '${component.trait}'.`);
  }
  if (!Array.isArray(results.archetypes) || !results.archetypes.length) fail(`${entry.id}: at least one archetype is required.`);
  for (const archetype of results.archetypes ?? []) {
    if (!archetype.id || !archetype.title || !archetype.tagline) fail(`${entry.id}: malformed archetype.`);
    for (const traitId of Object.keys(archetype.target ?? {})) if (!traitIds.has(traitId)) fail(`${entry.id}/archetype/${archetype.id}: unknown trait '${traitId}'.`);
  }

  const sections = results.sections ?? {};
  const endingOutcomes = new Set(Object.keys(sections.ending?.byOutcome ?? {}));
  for (const outcome of terminalOutcomes) if (!endingOutcomes.has(outcome)) fail(`${entry.id}: no ending text for outcome '${outcome}'.`);
  for (const outcome of endingOutcomes) if (!terminalOutcomes.has(outcome)) warn(`${entry.id}: ending '${outcome}' is not reachable from a terminal choice.`);
  validateRules(sections.ending?.appendRules, traitIds, `${entry.id}.sections.ending.appendRules`);
  validateRules(sections.psychology?.appendRules, traitIds, `${entry.id}.sections.psychology.appendRules`);
  for (const [groupIndex, group] of (sections.history?.groups ?? []).entries()) validateRules(group, traitIds, `${entry.id}.sections.history.groups[${groupIndex}]`);
  for (const [futureIndex, item] of (sections.future ?? []).entries()) validateRules(item.rules, traitIds, `${entry.id}.sections.future[${futureIndex}].rules`);
  validateRules(sections.match?.appendRules, traitIds, `${entry.id}.sections.match.appendRules`);
  validateRules(sections.warning?.rules, traitIds, `${entry.id}.sections.warning.rules`);

  console.log(`✓ ${entry.id}: ${story.scenes.length} scenes / ${maxSlot} slots / ${traitIds.size} traits`);
}

const catalog = await readJson(path.join(publicDir, "stories", "catalog.json"));
if (!Array.isArray(catalog.stories)) fail("catalog.stories must be an array.");
const catalogIds = new Set();
for (const entry of catalog.stories ?? []) {
  if (!entry.id || !entry.slug || !entry.storyUrl || !entry.resultsUrl) fail("Every catalog entry needs id, slug, storyUrl and resultsUrl.");
  if (catalogIds.has(entry.id)) fail(`Duplicate catalog story ID '${entry.id}'.`);
  catalogIds.add(entry.id);
  await validateStory(entry);
}

for (const message of warnings) console.warn(`WARN: ${message}`);
if (errors.length) {
  console.error("\nLove Right content validation failed:");
  for (const message of errors) console.error(`- ${message}`);
  process.exit(1);
}
console.log(`\nLove Right content validation passed (${catalog.stories.length} story package).`);
