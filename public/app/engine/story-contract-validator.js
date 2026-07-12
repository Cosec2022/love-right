const banned = ["targetArchetype","targetDistribution","targetShare","archetypeQuota","balancingBias","equalDistribution","randomEnding","randomChance"];
const facts = ["sets","clears","knowledgeChanges","concealmentChanges","promiseChanges","relationshipEffects","outcomeSignals","hiddenEndingSignals"];
const nonEmpty = (value) => Array.isArray(value) ? value.length > 0 : value && Object.keys(value).length > 0;
export function validateStoryContract(story) {
  const version = story.storyContractVersion ?? 1;
  if (version > 2) throw new Error(`${story.id}: unsupported storyContractVersion ${version}`);
  if (version < 2) return;
  for (const scene of story.scenes) for (const choice of scene.choices) {
    const where = `${story.id}/${scene.id}/slot-${scene.slot}/${choice.id}`;
    for (const key of banned) if (Object.hasOwn(choice, key) || Object.hasOwn(choice.hardEffect ?? {}, key) || Object.hasOwn(choice.softEffect ?? {}, key)) throw new Error(`${where}: forbidden contract field ${key}`);
    if (!choice.questionType || !["hard","soft"].includes(choice.questionType)) throw new Error(`${where}: questionType hard|soft is required`);
    if (!choice.sceneTrigger || !choice.whyNow) throw new Error(`${where}: sceneTrigger and whyNow are required`);
    if (choice.questionType === "hard") {
      const effect = choice.hardEffect;
      if (!effect?.action) throw new Error(`${where}: hardEffect.action is required`);
      if (!facts.some((key) => nonEmpty(effect[key]))) throw new Error(`${where}: hardEffect needs a factual change`);
      if (!nonEmpty(effect.requiredCallbacks)) throw new Error(`${where}: hardEffect.requiredCallbacks is required`);
      for (const key of ["outcomeSignals","hiddenEndingSignals"]) if ((effect[key] ?? []).some((value) => /ending|outcome/i.test(String(value)))) throw new Error(`${where}: ${key} must be factual signals`);
    } else {
      const effect = choice.softEffect;
      if (!effect?.perspective) throw new Error(`${where}: softEffect.perspective is required`);
      if (!effect.responseVariant && !effect.callbackTheme) throw new Error(`${where}: softEffect needs responseVariant or callbackTheme`);
      for (const key of facts) if (nonEmpty(effect[key])) throw new Error(`${where}: softEffect cannot contain ${key}`);
      if (Object.hasOwn(effect, "outcome") || Object.hasOwn(effect, "archetype")) throw new Error(`${where}: softEffect cannot specify outcome or archetype`);
    }
  }
}
