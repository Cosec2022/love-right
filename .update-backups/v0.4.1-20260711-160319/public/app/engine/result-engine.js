import { evaluateCondition } from "./condition-evaluator.js";

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

export class ResultEngine {
  constructor(story, resultsSpec, scoreEngine) {
    this.story = story;
    this.resultsSpec = resultsSpec;
    this.scoreEngine = scoreEngine;
    this.sceneMap = new Map(story.scenes.map((scene) => [scene.id, scene]));
  }

  pickArchetype(traits) {
    let best = null;
    let distance = Infinity;
    for (const archetype of this.resultsSpec.archetypes ?? []) {
      let current = 0;
      for (const [traitId, target] of Object.entries(archetype.target ?? {})) {
        const weight = archetype.weights?.[traitId] ?? 1;
        current += Math.pow((traits[traitId] - target) / 42, 2) * weight;
      }
      if (current < distance) {
        best = archetype;
        distance = current;
      }
    }
    if (!best) throw new Error("No result archetypes are configured.");
    return { ...best, distance };
  }

  buildEvidence(answers, traits) {
    const topTraits = Object.entries(traits)
      .sort((a, b) => Math.abs(b[1] - 50) - Math.abs(a[1] - 50))
      .slice(0, 4)
      .map(([id]) => id);
    const labels = Object.fromEntries(this.story.traits.map((trait) => [trait.id, trait.label]));

    return answers
      .map((answer) => {
        const relevant = topTraits
          .filter((traitId) => answer.effects?.[traitId])
          .map((traitId) => ({ id: traitId, value: answer.effects[traitId] }));
        const strength = relevant.reduce((sum, item) => sum + Math.abs(item.value), 0);
        return {
          strength,
          chapter: answer.chapter,
          choice: answer.choiceText,
          influence: relevant.map((item) => `${labels[item.id]}${item.value > 0 ? "+" : ""}${item.value}`).join(" · ")
        };
      })
      .filter((item) => item.strength > 0)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 3);
  }

  build(state) {
    const scoring = this.scoreEngine.calculate(state.answers);
    const meters = this.scoreEngine.deriveMeters(this.resultsSpec, scoring.traits);
    const archetype = this.pickArchetype(scoring.traits);
    const context = {
      traits: scoring.traits,
      rawTraits: scoring.rawTraits,
      meters,
      flags: state.flags,
      answers: state.answers,
      outcome: state.outcome,
      visited: state.visited,
      archetypeId: archetype.id
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
      meters,
      meterDefinitions: this.resultsSpec.meters,
      archetype,
      ending: [endingBase, endingTail].filter(Boolean),
      psychology: [psychologyBase, psychologyTail].filter(Boolean),
      history,
      future,
      match: { tags: archetype.tags ?? [], text: match },
      warning,
      evidence: this.buildEvidence(state.answers, scoring.traits),
      outcome: state.outcome
    };
  }
}
