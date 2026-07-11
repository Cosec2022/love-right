import { ScoreEngine } from "./score-engine.js";
export class ProfileBuilder {
  constructor(story) { this.scorer = new ScoreEngine(story); }
  build(answers) {
    const scoring = this.scorer.calculate(answers);
    const exposure = scoring.spatial.exposure;
    const reliability = Object.fromEntries(Object.entries(exposure).map(([axis, value]) => [axis, value ? Math.min(1, value / 3) : 0]));
    return { ...scoring, reliability };
  }
}
