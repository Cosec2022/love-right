/**
 * Love Right public four-character labels.
 *
 * These labels deliberately do NOT inherit the legacy eight archetypes. The
 * legacy archetypes remain useful as a detailed explanation layer, but several
 * older stories naturally collapse into one archetype. Public labels therefore
 * use an independent 4-bit portrait derived directly from the shared 16D trait
 * space, giving sixteen deterministic and auditable outcomes without runtime
 * quotas or random assignment.
 */

export const LABEL_AXES = Object.freeze({
  care: Object.freeze({ threshold: 57, title: "照顾倾向" }),
  expression: Object.freeze({ threshold: 61, title: "表达直接" }),
  idealization: Object.freeze({ threshold: 53, title: "浪漫投射" }),
  validation: Object.freeze({ threshold: 54, title: "被选需求" })
});

const LABELS_BY_CODE = Object.freeze([
  {
    id: "free-alliance",
    title: "自由盟友",
    hook: "你更相信两个完整的人并肩而行：不靠占有证明亲密，也不为爱情缩小自己的世界。"
  },
  {
    id: "only-radar",
    title: "唯一雷达",
    hook: "你不一定把需要说出口，却会敏锐捕捉自己是否被放在特别的位置。"
  },
  {
    id: "flowing-lover",
    title: "流动爱人",
    hook: "你会为心动保留诗意，也允许关系变化和呼吸，不急着用承诺把它固定。"
  },
  {
    id: "heart-deserter",
    title: "心动逃兵",
    hook: "你越被浪漫击中，越可能先把喜欢藏起来，因为最怕认真之后仍没有被选中。"
  },
  {
    id: "heart-vanguard",
    title: "心动先遣",
    hook: "你习惯先把信号送出去，不靠漫长猜测确认喜欢，也不把主动当作输赢。"
  },
  {
    id: "danger-near",
    title: "危险靠近",
    hook: "你会主动靠近，也会紧盯对方是否同样选择你；张力常在这一步一退之间发生。"
  },
  {
    id: "bright-cards",
    title: "热烈明牌",
    hook: "你愿意把浪漫和喜欢直接摊开，让彼此都看见这段关系正在发生。"
  },
  {
    id: "favor-captive",
    title: "偏爱囚徒",
    hook: "你敢于热烈表达，却也容易被偏爱的证据牵动；模糊回应会让你反复确认。"
  },
  {
    id: "ember-mender",
    title: "余烬修补",
    hook: "你不擅长高声表白，却会在细节里照顾关系，把仍值得的部分慢慢修好。"
  },
  {
    id: "favor-witness",
    title: "偏爱证人",
    hook: "你会通过持续行动照顾一段关系，也需要对方用同样具体的行动证明选择。"
  },
  {
    id: "late-heartbeat",
    title: "迟到心动",
    hook: "你的喜欢通常慢一步出现；当照顾和浪漫累积到足够真实，心动才会承认自己。"
  },
  {
    id: "moon-accomplice",
    title: "月光共犯",
    hook: "你会被两个人共同保守的暗号击中，偏爱、照顾与未说尽的话构成秘密同盟。"
  },
  {
    id: "certainty-belief",
    title: "确定主义",
    hook: "你愿意经营，也愿意把关系说清；真正让你安心的是双方都肯承担具体位置。"
  },
  {
    id: "sober-fall",
    title: "清醒沉沦",
    hook: "你知道自己需要被回应，也看得见现实代价，但确认彼此后仍会主动投入。"
  },
  {
    id: "soul-conspirator",
    title: "灵魂同谋",
    hook: "你想要的不只是陪伴，而是有人愿意表达、照顾，并和你在同一层情绪里看世界。"
  },
  {
    id: "gentle-gambler",
    title: "温柔赌徒",
    hook: "你会照顾、会表达、也会相信浪漫；即使知道爱有风险，仍愿意为明确的偏爱下注。"
  }
]);

export const FOUR_CHARACTER_LABELS = Object.freeze(
  LABELS_BY_CODE.map((label, code) => Object.freeze({ ...label, code }))
);

function finite(value, fallback = 50) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function bit(value, threshold) {
  return finite(value) >= threshold ? 1 : 0;
}

export function portraitCode(traits = {}) {
  const care = bit(traits.care, LABEL_AXES.care.threshold);
  const expression = bit(traits.expression, LABEL_AXES.expression.threshold);
  const idealization = bit(traits.idealization, LABEL_AXES.idealization.threshold);
  const validation = bit(traits.validation, LABEL_AXES.validation.threshold);
  return (care << 3) | (expression << 2) | (idealization << 1) | validation;
}

export function selectFourCharacterLabel(result = {}) {
  const traits = result.traits ?? {};
  const code = portraitCode(traits);
  const label = FOUR_CHARACTER_LABELS[code];
  return {
    ...label,
    profile: {
      care: finite(traits.care),
      expression: finite(traits.expression),
      idealization: finite(traits.idealization),
      validation: finite(traits.validation)
    },
    archetypeId: result?.archetype?.id ?? result?.archetypeId ?? null
  };
}

export function labelById(id) {
  return FOUR_CHARACTER_LABELS.find((entry) => entry.id === id) ?? null;
}
