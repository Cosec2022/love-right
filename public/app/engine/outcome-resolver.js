export function resolveOutcome(input = {}) {
  if (Object.hasOwn(input, "outcome") && !Object.hasOwn(input, "story")) return input.outcome ?? null;
  const { story, factState, state } = input;
  const contract = story?.outcomeContract;
  if (!contract) return state?.outcome ?? null;
  const has = (id) => Boolean(factState?.hardFacts?.[id]);
  const hidden = contract.hiddenEnding;
  if (hidden?.triggerLogic?.every?.(id => has(id))) return { id:hidden.id, title:hidden.title, hidden:true, badgeText:hidden.badgeText, matchedConditions:hidden.triggerLogic, evidence:factState };
  const matches = (contract.officialEndings ?? []).filter((ending) => ending.requiredHardFacts.every(has) && ending.forbiddenHardFacts.every((id) => !has(id)));
  if (matches.length !== 1) throw new Error(`Outcome contract expected one ending, found ${matches.length}.`);
  return { ...matches[0], hidden:false, badgeText:null, matchedConditions:matches[0].requiredHardFacts, evidence:factState };
}
