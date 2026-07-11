const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const zeros = (length) => new Float64Array(length);

const addScaled = (target, source, scale = 1) => {
  for (let index = 0; index < target.length; index += 1) {
    target[index] += source[index] * scale;
  }
};

const denseToObject = (axisIds, vector, transform = (value) => value) =>
  Object.fromEntries(axisIds.map((id, index) => [id, transform(vector[index], id, index)]));

const matrixToObject = (axisIds, matrix, transform = (value) => value) =>
  Object.fromEntries(axisIds.map((rowId, rowIndex) => [
    rowId,
    Object.fromEntries(axisIds.map((columnId, columnIndex) => [
      columnId,
      transform(matrix[rowIndex][columnIndex], rowId, columnId)
    ]))
  ]));

/**
 * Spatial scoring model
 *
 * A single answer is not a scalar label. It is a vector in an N-dimensional
 * relationship space. A completed story is represented by:
 *
 * - trajectory: T x N answer matrix
 * - profile: N-dimensional weighted centroid
 * - contextProfiles: C x N context matrix
 * - covariance: N x N interaction matrix
 * - variance/consistency: N-dimensional stability information
 * - trend: N-dimensional late-story minus early-story movement
 *
 * Authoring format stays readable with named objects. Internally everything is
 * compiled to Float64Array vectors/matrices.
 */
export class ScoreEngine {
  constructor(story) {
    this.story = story;
    this.space = story.space ?? {
      axes: (story.traits ?? []).map((trait) => ({ ...trait })),
      contexts: [{ id: "general", label: "综合情境" }],
      config: {}
    };

    this.axes = this.space.axes ?? [];
    if (!this.axes.length) throw new Error("Story space must define at least one axis.");

    this.axisIds = this.axes.map((axis) => axis.id);
    this.axisIndex = new Map(this.axisIds.map((id, index) => [id, index]));
    this.contexts = this.space.contexts?.length
      ? this.space.contexts
      : [{ id: "general", label: "综合情境" }];
    this.contextIds = this.contexts.map((context) => context.id);
    this.contextIndex = new Map(this.contextIds.map((id, index) => [id, index]));

    // Compatibility with the old public API.
    this.traitIds = this.axisIds;
  }

  compileVector(source = {}) {
    // New content uses `vector`; old content can still use `effects`.
    const named = source.vector ?? source.effects ?? {};
    const vector = zeros(this.axisIds.length);
    for (const [axisId, rawValue] of Object.entries(named)) {
      const index = this.axisIndex.get(axisId);
      if (index === undefined) continue;
      vector[index] = clamp(safeNumber(rawValue), -1, 1);
    }
    return vector;
  }

  getAnswerWeight(answer) {
    const intensity = clamp(safeNumber(answer.intensity, 1), 0.1, 2);
    const confidence = clamp(safeNumber(answer.confidence, 1), 0.1, 1);
    return intensity * confidence;
  }

  getAnswerContext(answer) {
    const contextId = answer.context ?? answer.contextId ?? "general";
    return this.contextIndex.has(contextId) ? contextId : "general";
  }

  calculateRaw(answers) {
    const raw = zeros(this.axisIds.length);
    for (const answer of answers) {
      addScaled(raw, this.compileVector(answer), this.getAnswerWeight(answer));
    }
    return denseToObject(this.axisIds, raw);
  }

  calculateSpatial(answers) {
    const axisCount = this.axisIds.length;
    const contextCount = this.contextIds.length;
    const weightedSum = zeros(axisCount);
    const weightedSquareSum = zeros(axisCount);
    const axisWeights = zeros(axisCount);
    const contextSums = Array.from({ length: contextCount }, () => zeros(axisCount));
    const contextAxisWeights = Array.from({ length: contextCount }, () => zeros(axisCount));
    const coactivation = Array.from({ length: axisCount }, () => zeros(axisCount));
    const coactivationWeights = Array.from({ length: axisCount }, () => zeros(axisCount));
    const explicitCross = Array.from({ length: axisCount }, () => zeros(axisCount));
    const trajectory = [];
    const answerVectors = [];
    let totalWeight = 0;

    const cumulative = zeros(axisCount);
    const cumulativeAxisWeights = zeros(axisCount);

    for (let answerIndex = 0; answerIndex < answers.length; answerIndex += 1) {
      const answer = answers[answerIndex];
      const vector = this.compileVector(answer);
      const weight = this.getAnswerWeight(answer);
      const contextId = this.getAnswerContext(answer);
      const contextIndex = this.contextIndex.get(contextId) ?? 0;

      answerVectors.push({
        answerIndex,
        sceneId: answer.sceneId,
        slot: answer.slot,
        chapter: answer.chapter,
        choiceId: answer.choiceId,
        choiceText: answer.choiceText,
        context: contextId,
        weight,
        vector: denseToObject(this.axisIds, vector)
      });

      for (let axis = 0; axis < axisCount; axis += 1) {
        const value = vector[axis];
        if (Math.abs(value) < 1e-9) continue;
        weightedSum[axis] += value * weight;
        weightedSquareSum[axis] += value * value * weight;
        axisWeights[axis] += weight;
        contextSums[contextIndex][axis] += value * weight;
        contextAxisWeights[contextIndex][axis] += weight;
        cumulative[axis] += value * weight;
        cumulativeAxisWeights[axis] += weight;
      }
      totalWeight += weight;

      // Preserve pairwise co-activation only where both axes were actually
      // assessed by the same answer. This prevents sparse dimensions from
      // being diluted by unrelated questions.
      for (let row = 0; row < axisCount; row += 1) {
        if (Math.abs(vector[row]) < 1e-9) continue;
        for (let column = 0; column < axisCount; column += 1) {
          if (Math.abs(vector[column]) < 1e-9) continue;
          coactivation[row][column] += vector[row] * vector[column] * weight;
          coactivationWeights[row][column] += weight;
        }
      }

      for (const item of answer.cross ?? answer.interactions ?? []) {
        const [leftId, rightId] = item.axes ?? [];
        const left = this.axisIndex.get(leftId);
        const right = this.axisIndex.get(rightId);
        if (left === undefined || right === undefined) continue;
        const value = clamp(safeNumber(item.value), -1, 1) * weight;
        explicitCross[left][right] += value;
        explicitCross[right][left] += value;
        coactivationWeights[left][right] += weight;
        coactivationWeights[right][left] += weight;
      }

      trajectory.push({
        answerIndex,
        profile: denseToObject(
          this.axisIds,
          cumulative,
          (value, _id, axis) => value / Math.max(cumulativeAxisWeights[axis], 1)
        )
      });
    }

    const priorWeight = clamp(safeNumber(this.space.config?.priorWeight, 0.65), 0, 20);
    const profile = zeros(axisCount);
    const variance = zeros(axisCount);
    const consistency = zeros(axisCount);

    for (let axis = 0; axis < axisCount; axis += 1) {
      const observedWeight = axisWeights[axis];
      profile[axis] = weightedSum[axis] / Math.max(observedWeight + priorWeight, 1);
      const meanWithoutPrior = weightedSum[axis] / Math.max(observedWeight, 1);
      const secondMoment = weightedSquareSum[axis] / Math.max(observedWeight, 1);
      variance[axis] = clamp(secondMoment - meanWithoutPrior ** 2, 0, 1);
      consistency[axis] = observedWeight > 0 ? 1 - Math.sqrt(variance[axis]) : 0.5;
    }

    const contextProfiles = {};
    for (let context = 0; context < contextCount; context += 1) {
      const contextId = this.contextIds[context];
      contextProfiles[contextId] = denseToObject(
        this.axisIds,
        contextSums[context],
        (value, _id, axis) => value / Math.max(contextAxisWeights[context][axis] + priorWeight * 0.35, 1)
      );
    }

    const interaction = Array.from({ length: axisCount }, () => zeros(axisCount));
    for (let row = 0; row < axisCount; row += 1) {
      for (let column = 0; column < axisCount; column += 1) {
        const denominator = Math.max(coactivationWeights[row][column], 1);
        const observed = coactivation[row][column] / denominator;
        const explicit = explicitCross[row][column] / denominator;
        interaction[row][column] = clamp(observed + explicit, -1, 1);
      }
    }

    const split = Math.floor(answerVectors.length / 2);
    const early = zeros(axisCount);
    const late = zeros(axisCount);
    const earlyWeights = zeros(axisCount);
    const lateWeights = zeros(axisCount);
    answerVectors.forEach((item, index) => {
      const vector = this.compileVector(item);
      for (let axis = 0; axis < axisCount; axis += 1) {
        if (Math.abs(vector[axis]) < 1e-9) continue;
        if (index < split) {
          early[axis] += vector[axis] * item.weight;
          earlyWeights[axis] += item.weight;
        } else {
          late[axis] += vector[axis] * item.weight;
          lateWeights[axis] += item.weight;
        }
      }
    });
    const trend = zeros(axisCount);
    for (let axis = 0; axis < axisCount; axis += 1) {
      const earlyMean = early[axis] / Math.max(earlyWeights[axis], 1);
      const lateMean = late[axis] / Math.max(lateWeights[axis], 1);
      trend[axis] = lateMean - earlyMean;
    }

    return {
      totalWeight,
      exposure: denseToObject(this.axisIds, axisWeights),
      profileDense: profile,
      profile: denseToObject(this.axisIds, profile),
      raw: denseToObject(this.axisIds, weightedSum),
      variance: denseToObject(this.axisIds, variance),
      consistency: denseToObject(this.axisIds, consistency),
      trend: denseToObject(this.axisIds, trend),
      contextProfiles,
      interaction: matrixToObject(this.axisIds, interaction),
      answerMatrix: answerVectors,
      trajectory
    };
  }

  normalizeProfile(profile) {
    const config = {
      center: 50,
      spread: 42,
      min: 8,
      max: 92,
      ...(this.story.scoreConfig ?? {}),
      ...(this.space.config?.display ?? {})
    };

    return Object.fromEntries(this.axisIds.map((axisId) => {
      const value = clamp(safeNumber(profile[axisId]), -1, 1);
      return [axisId, Math.round(clamp(
        config.center + config.spread * value,
        config.min,
        config.max
      ))];
    }));
  }

  calculate(answers) {
    const spatial = this.calculateSpatial(answers);
    return {
      rawTraits: spatial.raw,
      traits: this.normalizeProfile(spatial.profile),
      maxima: null,
      spatial
    };
  }

  deriveMeters(resultsSpec, traits, spatial = null) {
    return Object.fromEntries((resultsSpec.meters ?? []).map((meter) => {
      let total = 0;
      let totalWeight = 0;
      for (const component of meter.components ?? []) {
        const weight = component.weight ?? 1;
        let source = traits[component.trait] ?? 50;

        // Optional contextual meter component.
        if (component.context && spatial?.contextProfiles?.[component.context]) {
          const centered = spatial.contextProfiles[component.context][component.trait] ?? 0;
          source = Math.round(50 + centered * 42);
        }

        total += (component.inverse ? 100 - source : source) * weight;
        totalWeight += weight;
      }
      return [meter.id, Math.round(totalWeight ? total / totalWeight : 50)];
    }));
  }
}
