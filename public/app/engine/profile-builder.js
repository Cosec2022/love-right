import { ScoreEngine } from "./score-engine.js";

const HARD_RELIABILITY_CAP = 0.6;
const banned = new Set(["targetArchetype", "targetShare", "quota", "expectedDistribution", "outcome", "hiddenEnding"]);
const finite = (value, name) => { if (!Number.isFinite(value)) throw new Error(`Invalid profile evidence ${name}`); return value; };

export class ProfileBuilder {
  constructor(story) { this.story = story; this.scorer = new ScoreEngine(story); this.axes = this.scorer.axisIds; }
  build(answers) { return this.story.storyContractVersion === 2 ? this.buildV2Profile(answers) : this.buildLegacyProfile(answers); }
  buildLegacyProfile(answers) {
    const scoring = this.scorer.calculate(answers);
    const reliability = Object.fromEntries(Object.entries(scoring.spatial.exposure).map(([axis, value]) => [axis, value ? Math.min(1, value / 3) : 0]));
    return { ...scoring, modelVersion: 1, reliability, confidence: Object.values(reliability).reduce((sum, value) => sum + value, 0) / this.axes.length };
  }
  buildV2Profile(answers) {
    const buckets = Object.fromEntries(this.axes.map((axis) => [axis, []]));
    const evidenceBySlot = {};
    for (const answer of answers) {
      const choice = answer.choice ?? answer;
      const soft = choice.questionType === "soft" ? choice.softEffect?.profileEvidence ?? [] : [];
      const hard = choice.questionType === "hard" && choice.personalityEvidence?.stableMeaning === true ? choice.personalityEvidence.evidence ?? [] : [];
      const source = soft.length ? "soft-choice" : hard.length ? "stable-hard-choice" : null;
      const items = soft.length ? soft : hard;
      for (const item of items) {
        for (const key of banned) if (Object.hasOwn(item, key)) throw new Error(`Forbidden profile evidence ${key}`);
        if (!this.axes.includes(item.axis)) throw new Error(`Unknown profile evidence axis ${item.axis}`);
        const value = finite(item.value, "value"); const weight = finite(item.weight, "weight"); const reliability = finite(item.reliability, "reliability");
        if (weight <= 0 || reliability < 0 || reliability > 1 || !item.context) throw new Error("Invalid profile evidence contract");
        const appliedReliability = source === "stable-hard-choice" ? Math.min(reliability, HARD_RELIABILITY_CAP) : reliability;
        const evidence = { slot: answer.slot, optionId: answer.choiceId ?? choice.id, questionType: choice.questionType, source, axis:item.axis, rawValue:value, appliedWeight:weight, reliability:appliedReliability, context:item.context };
        buckets[item.axis].push(evidence); (evidenceBySlot[answer.slot] ??= []).push(evidence);
      }
    }
    const axes = {}; let totalEvidenceCount = 0; let confidenceTotal = 0;
    for (const axis of this.axes) {
      const evidence = buckets[axis]; totalEvidenceCount += evidence.length;
      const exposure = evidence.reduce((sum, item) => sum + item.appliedWeight, 0);
      const weighted = evidence.reduce((sum, item) => sum + item.rawValue * item.appliedWeight * item.reliability, 0);
      const reliability = exposure ? evidence.reduce((sum, item) => sum + item.reliability * item.appliedWeight, 0) / exposure : 0;
      axes[axis] = { value: exposure ? weighted / exposure : 0, exposure, reliability, evidenceCount:evidence.length };
      confidenceTotal += reliability;
    }
    const profile = Object.fromEntries(Object.entries(axes).map(([axis, data]) => [axis, data.value]));
    const observedAxisCount = Object.values(axes).filter((item) => item.reliability > 0).length;
    return { modelVersion:2, axes, profile, exposure:Object.fromEntries(Object.entries(axes).map(([axis, item]) => [axis,item.exposure])), reliability:Object.fromEntries(Object.entries(axes).map(([axis, item]) => [axis,item.reliability])), evidenceBySlot, observedAxisCount, totalEvidenceCount, confidence: confidenceTotal / this.axes.length };
  }
}
