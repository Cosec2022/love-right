const compare = (value, rule) => {
  if (Object.hasOwn(rule, "equals")) return value === rule.equals;
  if (Object.hasOwn(rule, "notEquals")) return value !== rule.notEquals;
  if (Object.hasOwn(rule, "gte")) return Number(value) >= Number(rule.gte);
  if (Object.hasOwn(rule, "lte")) return Number(value) <= Number(rule.lte);
  if (Object.hasOwn(rule, "gt")) return Number(value) > Number(rule.gt);
  if (Object.hasOwn(rule, "lt")) return Number(value) < Number(rule.lt);
  if (Array.isArray(rule.in)) return rule.in.includes(value);
  if (Array.isArray(rule.notIn)) return !rule.notIn.includes(value);
  return Boolean(value);
};

export function evaluateCondition(condition, context = {}) {
  if (!condition || condition.default === true) return true;
  if (Array.isArray(condition.all)) {
    return condition.all.every((part) => evaluateCondition(part, context));
  }
  if (Array.isArray(condition.any)) {
    return condition.any.some((part) => evaluateCondition(part, context));
  }
  if (condition.not) return !evaluateCondition(condition.not, context);

  if (condition.flag) return compare(context.flags?.[condition.flag], condition);
  if (condition.trait) return compare(context.traits?.[condition.trait], condition);
  if (condition.rawTrait) return compare(context.rawTraits?.[condition.rawTrait], condition);
  if (condition.meter) return compare(context.meters?.[condition.meter], condition);
  if (Object.hasOwn(condition, "outcome")) return context.outcome === condition.outcome;
  if (Object.hasOwn(condition, "archetype")) return context.archetypeId === condition.archetype;
  if (condition.visited) return Boolean(context.visited?.includes(condition.visited));
  if (condition.answer) {
    return context.answers?.some((answer) =>
      answer.sceneId === condition.answer.sceneId &&
      (!condition.answer.choiceId || answer.choiceId === condition.answer.choiceId)
    ) ?? false;
  }

  return false;
}

export function resolveConditionalTarget(target, context) {
  if (typeof target === "string") return target;
  if (!target || typeof target !== "object") return null;
  for (const item of target.cases ?? []) {
    if (evaluateCondition(item.when, context)) return item.to;
  }
  return target.default ?? null;
}
