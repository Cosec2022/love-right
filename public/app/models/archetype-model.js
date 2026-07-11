export const archetypeModelV2 = {
  modelVersion: 2,
  blendThreshold: 0.035,
  archetypes: [
    ["direct-pursuit", { approach:.7, expression:.5, certainty:.3 }, { approach:1, expression:.8, certainty:.5 }],
    ["clear-slow", { discernment:.7, autonomy:.45, approach:-.2 }, { discernment:1, autonomy:.7, approach:.5 }],
    ["steady-confirm", { certainty:.7, commitment:.5, reassurance:.35 }, { certainty:1, commitment:.7, reassurance:.5 }],
    ["chosen-sensitive", { validation:.7, abandonment:.45, care:.3 }, { validation:1, abandonment:.7, care:.4 }],
    ["repair-nurturer", { repair:.7, care:.55, conflict:.35 }, { repair:1, care:.8, conflict:.5 }],
    ["romantic-resonance", { idealization:.7, novelty:.5, trust:.25 }, { idealization:1, novelty:.8, trust:.4 }],
    ["free-close", { autonomy:.7, trust:.3, approach:.15 }, { autonomy:1, trust:.5, approach:.35 }],
    ["push-pull", { abandonment:.65, reassurance:.55, approach:-.2 }, { abandonment:1, reassurance:.8, approach:.4 }]
  ].map(([id, canonicalPrototype, axisWeights]) => ({ id, canonicalPrototype, axisWeights, minimumEvidence:.3 }))
};
