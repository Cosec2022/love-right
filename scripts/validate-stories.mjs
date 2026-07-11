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
const relationshipKeys = new Set(["warmth", "trust", "guard", "hurt", "tension", "repair"]);

function targetsFrom(next) {
  if (!next) return [];
  if (typeof next === "string") return [next];
  return [...(next.cases ?? []).map((item) => item.to), next.default].filter(Boolean);
}

function validateCondition(condition, axes, where) {
  if (!condition || condition.default === true) return;
  for (const key of ["all", "any"]) {
    if (condition[key]) condition[key].forEach((item, index) => validateCondition(item, axes, `${where}.${key}[${index}]`));
  }
  if (condition.not) validateCondition(condition.not, axes, `${where}.not`);
  if (condition.trait && !axes.has(condition.trait)) fail(`${where}: unknown trait '${condition.trait}'.`);
  if (condition.rawTrait && !axes.has(condition.rawTrait)) fail(`${where}: unknown raw trait '${condition.rawTrait}'.`);
  if (condition.path && typeof condition.path !== "string") fail(`${where}: path must be a string.`);
}

function validateRules(rules, axes, where) {
  for (const [index, rule] of (rules ?? []).entries()) {
    if (!rule.text) fail(`${where}[${index}] is missing text.`);
    if (!rule.default) validateCondition(rule.when, axes, `${where}[${index}].when`);
  }
}

async function validateStory(entry) {
  const storyFile = path.join(publicDir, entry.storyUrl.replace(/^\.\//, ""));
  const resultsFile = path.join(publicDir, entry.resultsUrl.replace(/^\.\//, ""));
  let story;
  let results;
  try { story = await readJson(storyFile); } catch (error) { fail(`${entry.id}: cannot read story file: ${error.message}`); return; }
  try { results = await readJson(resultsFile); } catch (error) { fail(`${entry.id}: cannot read results file: ${error.message}`); return; }

  if (story.schemaVersion !== 2) fail(`${entry.id}: story.schemaVersion must be 2.`);
  if (results.schemaVersion !== 2) fail(`${entry.id}: results.schemaVersion must be 2.`);
  if (story.id !== entry.id) fail(`${entry.id}: catalog/story ID mismatch (${story.id}).`);
  if (results.storyId !== story.id) fail(`${entry.id}: results.storyId mismatch (${results.storyId}).`);
  if (!story.metadata?.title) fail(`${entry.id}: metadata.title is required.`);
  if (!['female', 'male', 'all'].includes(story.metadata?.audience)) fail(`${entry.id}: metadata.audience must be female, male or all.`);
  if (!Array.isArray(story.scenes) || !story.scenes.length) fail(`${entry.id}: scenes must be a non-empty array.`);

  const axesList = story.space?.axes ?? story.traits ?? [];
  if (!Array.isArray(axesList) || !axesList.length) fail(`${entry.id}: space.axes must be a non-empty array.`);
  const axisIds = new Set();
  for (const axis of axesList) {
    if (!axis.id || !axis.label) fail(`${entry.id}: every axis needs id and label.`);
    if (axisIds.has(axis.id)) fail(`${entry.id}: duplicate axis '${axis.id}'.`);
    axisIds.add(axis.id);
  }
  const contextIds = new Set((story.space?.contexts ?? [{ id: "general" }]).map((item) => item.id));
  contextIds.add("general");

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
    if (scene.context && !contextIds.has(scene.context)) fail(`${entry.id}/${scene.id}: unknown context '${scene.context}'.`);
    if (scene.decisionType) {
      if (!['hard', 'final'].includes(scene.decisionType)) fail(`${entry.id}/${scene.id}: invalid decisionType '${scene.decisionType}'.`);
      if (!scene.decisionLabel || !scene.decisionNote) fail(`${entry.id}/${scene.id}: decision scenes require decisionLabel and decisionNote.`);
      for (const choice of scene.choices ?? []) {
        if (!choice.subtext || choice.subtext.trim().length < 8) fail(`${entry.id}/${scene.id}/${choice.id}: decision choices require meaningful subtext.`);
      }
      if (scene.decisionType === 'final') {
        for (const choice of scene.choices ?? []) {
          const targets = targetsFrom(choice.next ?? scene.next);
          if (targets.some((target) => target !== '$result')) fail(`${entry.id}/${scene.id}/${choice.id}: final decision must lead to $result.`);
          if (!choice.finalReveal?.title || !choice.finalReveal?.copy || choice.finalReveal.copy.trim().length < 40) fail(`${entry.id}/${scene.id}/${choice.id}: final decision requires a substantial finalReveal.`);
        }
      }
    }

    const choiceIds = new Set();
    for (const choice of scene.choices ?? []) {
      if (!choice.id || !choice.text) fail(`${entry.id}/${scene.id}: every choice needs id and text.`);
      if (choiceIds.has(choice.id)) fail(`${entry.id}/${scene.id}: duplicate choice '${choice.id}'.`);
      choiceIds.add(choice.id);
      const vector = choice.vector ?? choice.effects ?? {};
      if (!Object.keys(vector).length) warn(`${entry.id}/${scene.id}/${choice.id}: empty vector.`);
      for (const [axisId, value] of Object.entries(vector)) {
        if (!axisIds.has(axisId)) fail(`${entry.id}/${scene.id}/${choice.id}: unknown axis '${axisId}'.`);
        if (typeof value !== "number" || !Number.isFinite(value)) fail(`${entry.id}/${scene.id}/${choice.id}: vector '${axisId}' must be numeric.`);
        if (Math.abs(value) > 1) fail(`${entry.id}/${scene.id}/${choice.id}: vector '${axisId}' must stay in [-1, 1].`);
      }
      const context = choice.context ?? scene.context ?? "general";
      if (!contextIds.has(context)) fail(`${entry.id}/${scene.id}/${choice.id}: unknown context '${context}'.`);
      if (choice.intensity !== undefined && (!Number.isFinite(choice.intensity) || choice.intensity <= 0 || choice.intensity > 2)) fail(`${entry.id}/${scene.id}/${choice.id}: intensity must be in (0, 2].`);
      if (choice.confidence !== undefined && (!Number.isFinite(choice.confidence) || choice.confidence <= 0 || choice.confidence > 1)) fail(`${entry.id}/${scene.id}/${choice.id}: confidence must be in (0, 1].`);
      for (const item of choice.cross ?? []) {
        const [left, right] = item.axes ?? [];
        if (!axisIds.has(left) || !axisIds.has(right)) fail(`${entry.id}/${scene.id}/${choice.id}: invalid cross axes.`);
      }
      for (const [key, value] of Object.entries(choice.relationship ?? {})) {
        if (!relationshipKeys.has(key)) fail(`${entry.id}/${scene.id}/${choice.id}: unknown relationship key '${key}'.`);
        if (!Number.isFinite(value) || Math.abs(value) > 2) fail(`${entry.id}/${scene.id}/${choice.id}: relationship '${key}' must be numeric in [-2, 2].`);
      }
      if (choice.aftermath !== undefined && String(choice.aftermath).trim().length < 8) fail(`${entry.id}/${scene.id}/${choice.id}: aftermath is too short to carry emotional continuity.`);
    }
  }

  if (!sceneIds.has(story.initialScene)) fail(`${entry.id}: initialScene '${story.initialScene}' does not exist.`);
  const maxSlot = Math.max(...slots);
  for (let slot = 1; slot <= maxSlot; slot += 1) if (!slots.has(slot)) fail(`${entry.id}: assessment slot ${slot} is missing.`);
  if (story.status === "published" && maxSlot !== 18) fail(`${entry.id}: published stories must contain exactly 18 assessment slots (found ${maxSlot}).`);

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
        for (const [index, item] of (next.cases ?? []).entries()) validateCondition(item.when, axisIds, `${entry.id}/${scene.id}/${choice.id}.next.cases[${index}].when`);
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
    if (colors.get(sceneId) === 1) { fail(`${entry.id}: cycle detected: ${[...trail, sceneId].join(" -> ")}.`); return; }
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
    for (const component of meter.components ?? []) if (!axisIds.has(component.trait)) fail(`${entry.id}/meter/${meter.id}: unknown axis '${component.trait}'.`);
  }
  if (!Array.isArray(results.archetypes) || !results.archetypes.length) fail(`${entry.id}: at least one archetype is required.`);
  const archetypeIds = new Set();
  for (const archetype of results.archetypes ?? []) {
    if (!archetype.id || !archetype.title || !archetype.tagline) fail(`${entry.id}: malformed archetype.`);
    if (archetypeIds.has(archetype.id)) fail(`${entry.id}: duplicate archetype '${archetype.id}'.`);
    archetypeIds.add(archetype.id);
    const center = archetype.center ?? archetype.target ?? {};
    for (const axisId of Object.keys(center)) if (!axisIds.has(axisId)) fail(`${entry.id}/archetype/${archetype.id}: unknown axis '${axisId}'.`);
    for (const [contextId, target] of Object.entries(archetype.contextCenters ?? {})) {
      if (!contextIds.has(contextId)) fail(`${entry.id}/archetype/${archetype.id}: unknown context '${contextId}'.`);
      for (const axisId of Object.keys(target)) if (!axisIds.has(axisId)) fail(`${entry.id}/archetype/${archetype.id}: unknown context axis '${axisId}'.`);
    }
    for (const gate of archetype.gates ?? []) validateCondition(gate.when, axisIds, `${entry.id}/archetype/${archetype.id}.gates`);
  }

  const blendPairs = results.spatialModel?.blendPairs ?? [];
  for (const [index, pair] of blendPairs.entries()) {
    if (!Array.isArray(pair) || pair.length !== 2) fail(`${entry.id}: blendPairs[${index}] must contain two archetype IDs.`);
    else if (!archetypeIds.has(pair[0]) || !archetypeIds.has(pair[1])) fail(`${entry.id}: blendPairs[${index}] references an unknown archetype.`);
  }
  const sections = results.sections ?? {};
  const endingOutcomes = new Set(Object.keys(sections.ending?.byOutcome ?? {}));
  for (const outcome of terminalOutcomes) if (!endingOutcomes.has(outcome)) fail(`${entry.id}: no ending text for outcome '${outcome}'.`);
  for (const outcome of endingOutcomes) if (!terminalOutcomes.has(outcome)) warn(`${entry.id}: ending '${outcome}' is not reachable from a terminal choice.`);
  validateRules(sections.ending?.appendRules, axisIds, `${entry.id}.sections.ending.appendRules`);
  for (const archetypeId of archetypeIds) {
    if (!sections.psychology?.byArchetype?.[archetypeId]) fail(`${entry.id}: psychology text missing for archetype '${archetypeId}'.`);
  }
  validateRules(sections.psychology?.appendRules, axisIds, `${entry.id}.sections.psychology.appendRules`);
  for (const [groupIndex, group] of (sections.history?.groups ?? []).entries()) validateRules(group, axisIds, `${entry.id}.sections.history.groups[${groupIndex}]`);
  for (const [futureIndex, item] of (sections.future ?? []).entries()) validateRules(item.rules, axisIds, `${entry.id}.sections.future[${futureIndex}].rules`);
  validateRules(sections.match?.appendRules, axisIds, `${entry.id}.sections.match.appendRules`);
  validateRules(sections.warning?.rules, axisIds, `${entry.id}.sections.warning.rules`);

  console.log(`✓ ${entry.id}: ${story.scenes.length} scenes / ${maxSlot} slots / ${axisIds.size}D space / ${results.archetypes.length} archetypes`);
}

const catalog = await readJson(path.join(publicDir, "stories", "catalog.json"));
if (catalog.schemaVersion !== 2) fail("catalog.schemaVersion must be 2.");
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
console.log(`\nLove Right content validation passed (${catalog.stories.length} story packages).`);
