const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class ScoreEngine {
  constructor(story) {
    this.story = story;
    this.traitIds = story.traits.map((trait) => trait.id);
    this.maxAbsByTrait = this.calculateTheoreticalMaxima();
  }

  calculateTheoreticalMaxima() {
    const slots = new Map();
    for (const scene of this.story.scenes) {
      if (!slots.has(scene.slot)) slots.set(scene.slot, []);
      slots.get(scene.slot).push(scene);
    }

    const maxima = Object.fromEntries(this.traitIds.map((id) => [id, 0]));
    for (const scenes of slots.values()) {
      for (const traitId of this.traitIds) {
        let slotMax = 0;
        for (const scene of scenes) {
          for (const choice of scene.choices) {
            slotMax = Math.max(slotMax, Math.abs(choice.effects?.[traitId] ?? 0));
          }
        }
        maxima[traitId] += slotMax;
      }
    }
    return maxima;
  }

  calculateRaw(answers) {
    const raw = Object.fromEntries(this.traitIds.map((id) => [id, 0]));
    for (const answer of answers) {
      for (const traitId of this.traitIds) {
        raw[traitId] += answer.effects?.[traitId] ?? 0;
      }
    }
    return raw;
  }

  normalize(rawTraits) {
    const config = {
      center: 50,
      spread: 42,
      min: 8,
      max: 92,
      ...this.story.scoreConfig
    };
    return Object.fromEntries(this.traitIds.map((traitId) => {
      const denominator = this.maxAbsByTrait[traitId] || 1;
      const value = config.center + config.spread * ((rawTraits[traitId] ?? 0) / denominator);
      return [traitId, Math.round(clamp(value, config.min, config.max))];
    }));
  }

  calculate(answers) {
    const rawTraits = this.calculateRaw(answers);
    return { rawTraits, traits: this.normalize(rawTraits), maxima: this.maxAbsByTrait };
  }

  deriveMeters(resultsSpec, traits) {
    return Object.fromEntries((resultsSpec.meters ?? []).map((meter) => {
      let total = 0;
      let totalWeight = 0;
      for (const component of meter.components ?? []) {
        const weight = component.weight ?? 1;
        const source = traits[component.trait] ?? 50;
        total += (component.inverse ? 100 - source : source) * weight;
        totalWeight += weight;
      }
      return [meter.id, Math.round(totalWeight ? total / totalWeight : 50)];
    }));
  }
}
