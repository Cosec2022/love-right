import { evaluateCondition } from "./condition-evaluator.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const selectFirst = (rules, context) => {
  for (const rule of rules ?? []) {
    if (rule.default === true || evaluateCondition(rule.when, context)) return rule.text ?? "";
  }
  return "";
};

const selectAll = (rules, context) => (rules ?? [])
  .filter((rule) => !rule.default && evaluateCondition(rule.when, context))
  .map((rule) => rule.text)
  .filter(Boolean);

const centeredValue = (value) => clamp((value - 50) / 42, -1, 1);

const cosineSimilarity = (left, right, keys) => {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (const key of keys) {
    const a = left[key] ?? 0;
    const b = right[key] ?? 0;
    dot += a * b;
    leftMagnitude += a * a;
    rightMagnitude += b * b;
  }
  if (!leftMagnitude || !rightMagnitude) return 0;
  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
};

const rmsDistance = (left, right, keys, weights = {}) => {
  let total = 0;
  let totalWeight = 0;
  for (const key of keys) {
    const weight = weights[key] ?? 1;
    total += ((left[key] ?? 0) - (right[key] ?? 0)) ** 2 * weight;
    totalWeight += weight;
  }
  return Math.sqrt(total / Math.max(totalWeight, 1));
};

export class ResultEngine {
  constructor(story, resultsSpec, scoreEngine) {
    this.story = story;
    this.resultsSpec = resultsSpec;
    this.scoreEngine = scoreEngine;
    this.sceneMap = new Map(story.scenes.map((scene) => [scene.id, scene]));
  }

  passesGates(archetype, context) {
    const gates = archetype.gates ?? [];
    const failed = [];
    for (const gate of gates) {
      if (!evaluateCondition(gate.when, context)) failed.push(gate);
    }
    return { passed: failed.length === 0, failed };
  }

  scoreArchetype(archetype, scoring) {
    const userVector = scoring.spatial.profile;
    const centerSource = archetype.center ?? archetype.target ?? {};
    const centerVector = Object.fromEntries(Object.entries(centerSource).map(([axisId, value]) => [
      axisId,
      Math.abs(value) > 1 ? centeredValue(value) : value
    ]));
    const keys = Object.keys(centerVector);
    if (!keys.length) return { score: -Infinity, similarity: 0, distance: Infinity };

    const similarity = cosineSimilarity(userVector, centerVector, keys);
    const distance = rmsDistance(userVector, centerVector, keys, archetype.weights);
    const distanceScore = 1 - clamp(distance / 2, 0, 1);

    if (this.resultsSpec.spatialModel?.mode === "cluster") {
      return {
        score: distanceScore,
        similarity,
        distance,
        components: { similarity: (similarity + 1) / 2, distance: distanceScore, context: 0.5, interaction: 0.5, consistency: 0.5 }
      };
    }

    let contextScore = 0.5;
    let contextWeight = 0;
    let contextTotal = 0;
    for (const [contextId, target] of Object.entries(archetype.contextCenters ?? {})) {
      const profile = scoring.spatial.contextProfiles?.[contextId];
      if (!profile) continue;
      const contextKeys = Object.keys(target);
      contextTotal += (cosineSimilarity(profile, target, contextKeys) + 1) / 2;
      contextWeight += 1;
    }
    if (contextWeight) contextScore = contextTotal / contextWeight;

    let interactionScore = 0.5;
    let interactionWeight = 0;
    let interactionTotal = 0;
    for (const item of archetype.interactionTargets ?? []) {
      const [left, right] = item.axes ?? [];
      const observed = scoring.spatial.interaction?.[left]?.[right];
      if (observed === undefined) continue;
      const target = clamp(item.value ?? 0, -1, 1);
      const itemWeight = item.weight ?? 1;
      interactionTotal += (1 - Math.abs(observed - target) / 2) * itemWeight;
      interactionWeight += itemWeight;
    }
    if (interactionWeight) interactionScore = interactionTotal / interactionWeight;

    const consistencyAxes = archetype.consistencyAxes ?? [];
    const consistencyScore = consistencyAxes.length
      ? consistencyAxes.reduce((sum, axisId) => sum + (scoring.spatial.consistency?.[axisId] ?? 0.5), 0) / consistencyAxes.length
      : 0.5;

    const modelWeights = {
      similarity: 0.40,
      distance: 0.32,
      context: 0.13,
      interaction: 0.10,
      consistency: 0.05,
      ...(this.resultsSpec.spatialModel?.weights ?? {})
    };

    const normalizedSimilarity = (similarity + 1) / 2;
    const score =
      normalizedSimilarity * modelWeights.similarity +
      distanceScore * modelWeights.distance +
      contextScore * modelWeights.context +
      interactionScore * modelWeights.interaction +
      consistencyScore * modelWeights.consistency;

    return {
      score,
      similarity,
      distance,
      components: {
        similarity: normalizedSimilarity,
        distance: distanceScore,
        context: contextScore,
        interaction: interactionScore,
        consistency: consistencyScore
      }
    };
  }

  pickArchetype(scoring, stateContext = {}) {
    const context = {
      traits: scoring.traits,
      rawTraits: scoring.rawTraits,
      spatial: scoring.spatial,
      ...stateContext
    };

    const ranked = [];
    for (const archetype of this.resultsSpec.archetypes ?? []) {
      const gates = this.passesGates(archetype, context);
      const model = this.scoreArchetype(archetype, scoring);
      const gatePenalty = gates.passed ? 0 : (archetype.gatePenalty ?? 0.45);
      const bias = archetype.bias ?? 0;
      ranked.push({
        ...archetype,
        ...model,
        gatePassed: gates.passed,
        failedGates: gates.failed,
        finalScore: model.score + bias - gatePenalty
      });
    }

    ranked.sort((a, b) => b.finalScore - a.finalScore);
    const primary = ranked[0];
    if (!primary) throw new Error("No result archetypes are configured.");
    const secondary = ranked[1] ?? null;
    const blendThreshold = this.resultsSpec.spatialModel?.blendThreshold ?? 0.0065;
    const margin = secondary ? primary.finalScore - secondary.finalScore : 1;
    const configuredPairs = this.resultsSpec.spatialModel?.blendPairs ?? [];
    const pairKey = (left, right) => [left, right].sort().join("::");
    const allowedPairs = new Set(configuredPairs.map(([left, right]) => pairKey(left, right)));
    const blendCompatible = !secondary || !allowedPairs.size || allowedPairs.has(pairKey(primary.id, secondary.id));
    const blendedSecondary = secondary && margin < blendThreshold && blendCompatible ? secondary : null;

    return {
      ...primary,
      distance: primary.distance,
      margin,
      confidence: clamp(margin / Math.max(blendThreshold * 3, 0.0001), 0, 1),
      secondary: blendedSecondary,
      ranking: ranked.map(({ id, title, finalScore, gatePassed }) => ({ id, title, finalScore, gatePassed }))
    };
  }

  buildEvidence(answers, scoring) {
    const traits = scoring.traits;
    const topTraits = Object.entries(traits)
      .sort((a, b) => Math.abs(b[1] - 50) - Math.abs(a[1] - 50))
      .slice(0, 5)
      .map(([id]) => id);
    const labels = Object.fromEntries((this.story.space?.axes ?? this.story.traits ?? []).map((axis) => [axis.id, axis.label]));

    return answers
      .map((answer) => {
        const vector = answer.vector ?? answer.effects ?? {};
        const relevant = topTraits
          .filter((axisId) => vector[axisId])
          .map((axisId) => ({ id: axisId, value: vector[axisId] }));
        const strength = relevant.reduce((sum, item) => sum + Math.abs(item.value), 0);
        return {
          strength,
          chapter: answer.chapter,
          choice: answer.choiceText,
          context: answer.context ?? "general",
          influence: relevant.map((item) => `${labels[item.id] ?? item.id}${item.value > 0 ? "+" : ""}${item.value}`).join(" · ")
        };
      })
      .filter((item) => item.strength > 0)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 4);
  }

  build(state) {
    const scoring = this.scoreEngine.calculate(state.answers);
    const meters = this.scoreEngine.deriveMeters(this.resultsSpec, scoring.traits, scoring.spatial);
    const archetype = this.pickArchetype(scoring, {
      meters,
      flags: state.flags,
      answers: state.answers,
      outcome: state.outcome,
      visited: state.visited
    });
    const context = {
      traits: scoring.traits,
      rawTraits: scoring.rawTraits,
      spatial: scoring.spatial,
      meters,
      flags: state.flags,
      answers: state.answers,
      outcome: state.outcome,
      visited: state.visited,
      archetypeId: archetype.id,
      secondaryArchetypeId: archetype.secondary?.id ?? null
    };
    const sections = this.resultsSpec.sections;

    const endingBase = sections.ending.byOutcome[state.outcome] ?? "你的故事停在了一个仍然可以继续的地方。";
    const endingTail = selectFirst(sections.ending.appendRules, context);

    const psychologyBase = sections.psychology.byArchetype[archetype.id] ?? archetype.tagline;
    const psychologyTail = selectFirst(sections.psychology.appendRules, context);

    const history = (sections.history.groups ?? []).map((group) => selectFirst(group, context)).filter(Boolean);
    const future = (sections.future ?? []).map((slot) => ({ title: slot.title, text: selectFirst(slot.rules, context) }));
    const match = [sections.match.base, ...selectAll(sections.match.appendRules, context)].filter(Boolean).join(" ");
    const warning = selectFirst(sections.warning.rules, context);

    return {
      story: this.story.metadata,
      traits: scoring.traits,
      rawTraits: scoring.rawTraits,
      spatial: scoring.spatial,
      meters,
      meterDefinitions: this.resultsSpec.meters,
      archetype,
      ending: [endingBase, endingTail].filter(Boolean),
      psychology: [psychologyBase, psychologyTail].filter(Boolean),
      history,
      future,
      match: { tags: archetype.tags ?? [], text: match },
      warning,
      evidence: this.buildEvidence(state.answers, scoring),
      outcome: state.outcome
    };
  }
}
