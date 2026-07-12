const clone = (value) => structuredClone(value);
export const createInitialFactState = () => ({ flags:{}, hardFacts:{}, knowledge:{}, concealments:{}, promises:{}, relationshipFacts:{}, completedCallbacks:[], hardChoiceHistory:[] });
export function applyHardEffect(state, choice) {
  const effect = choice.hardEffect ?? {};
  const next = clone(state);
  for (const id of effect.sets ?? []) next.hardFacts[id] = true;
  for (const id of effect.clears ?? []) delete next.hardFacts[id];
  Object.assign(next.knowledge, effect.knowledgeChanges ?? {});
  Object.assign(next.concealments, effect.concealmentChanges ?? {});
  Object.assign(next.promises, effect.promiseChanges ?? {});
  Object.assign(next.relationshipFacts, effect.relationshipEffects ?? {});
  next.hardChoiceHistory.push(choice.id);
  return next;
}
export const applySoftEffect = (state) => clone(state);
export const markCallbackCompleted = (state, id) => ({ ...clone(state), completedCallbacks:[...state.completedCallbacks, id] });
export const hasFact = (state, id) => Boolean(state.hardFacts[id]);
export const serializeFactState = (state) => clone(state);
export const restoreFactState = (snapshot) => ({ ...createInitialFactState(), ...clone(snapshot ?? {}) });
