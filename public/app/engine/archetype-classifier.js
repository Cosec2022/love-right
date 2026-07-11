import { archetypeModelV2 } from "../models/archetype-model.js";
export class ArchetypeClassifier {
  classify(profile, reliability) {
    const ranked = archetypeModelV2.archetypes.map((model) => {
      let weighted = 0, total = 0;
      for (const [axis, target] of Object.entries(model.canonicalPrototype)) {
        const weight = (model.axisWeights[axis] ?? 1) * (reliability[axis] ?? 0);
        if (!weight) continue;
        weighted += (1 - Math.abs((profile[axis] ?? 0) - target) / 2) * weight;
        total += weight;
      }
      return { ...model, score: total ? weighted / total : -Infinity, evidence: total };
    }).sort((a,b) => b.score-a.score);
    const [primary, secondary] = ranked;
    return { primary, secondary: secondary && primary.score-secondary.score < archetypeModelV2.blendThreshold ? secondary : null, scores: ranked, margin: primary.score-secondary.score, evidence: primary.evidence };
  }
}
