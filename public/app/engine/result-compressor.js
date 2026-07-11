const DEFAULT_PROFILES = {
  "clear-slow": {
    title: "只会被行动打动的人",
    hook: "你不是不相信心动，只是不愿把未来交给一句漂亮话。",
    contradiction: "你会允许自己心动，却会在最心动的时候重新检查现实。",
    attraction: "真正打动你的，不是第一次有多特别，而是他在后来的普通日子里仍然认真。",
    fear: "你最怕感觉走得太快，现实却始终没有跟上。",
    fit: "适合你的人不催你交出信任，也不会把“慢慢来”当成长期不表态的借口。"
  },
  "steady-confirm": {
    title: "等一句确定的人",
    hook: "你可以等一个人慢慢靠近，但不能一直没有答案。",
    contradiction: "你看起来很能等，真正不能接受的却是等待从来没有方向。",
    attraction: "让你放下戒心的，是对方把模糊的喜欢变成清楚的位置和持续的行动。",
    fear: "你最怕两个人已经像恋人一样投入，却始终没有人愿意承担关系。",
    fit: "适合你的人不需要天天宣誓，但会让你知道自己在他的生活里是什么位置。"
  },
  "romantic-resonance": {
    title: "会把细节记很久的人",
    hook: "你真正忘不掉的，往往不是大场面，而是只有你注意到的小事。",
    contradiction: "你能被一个细节打动很久，也会因为另一个细节突然失去感觉。",
    attraction: "一句恰到好处的话、一个被记住的习惯，往往比标准答案更容易击中你。",
    fear: "你最怕那些漂亮瞬间只是偶然，对方并没有真正理解你。",
    fit: "适合你的人有感受力，也有兑现能力；他会制造浪漫，但不会只活在浪漫里。"
  },
  "direct-pursuit": {
    title: "喜欢就不想一直猜的人",
    hook: "你不怕认真，怕的是两个人明明在意，却都把喜欢耗在试探里。",
    contradiction: "你敢靠近并不是因为不怕受伤，而是不愿把真心浪费在无休止的猜测里。",
    attraction: "你会被坦率、回应及时和愿意推进关系的人吸引。",
    fear: "你最怕对方享受你的主动，却始终不给出同等清楚的回应。",
    fit: "适合你的人不躲在暧昧后面，会接住你的坦率，也会主动承担下一步。"
  },
  "free-close": {
    title: "靠近了也不想失去自己的人",
    hook: "你想要亲密，也想在爱里继续保有完整的生活和判断。",
    contradiction: "你需要被理解，却不希望任何人用“在乎你”来接管你的节奏。",
    attraction: "你会被有自己生活、尊重边界，又愿意稳定靠近的人吸引。",
    fear: "你最怕一段关系刚开始甜蜜，后来却慢慢变成解释、报备和失去空间。",
    fit: "适合你的人不会把距离当冷淡，也不会把自由当失联；他懂得亲密和独立可以同时存在。"
  },
  "chosen-sensitive": {
    title: "最想被坚定选择的人",
    hook: "你要的不是很多人喜欢，而是一个人在重要时刻一次次站在你这边。",
    contradiction: "你看起来在等一句话，真正等的是麻烦出现以后，对方仍然不把你放下。",
    attraction: "明确的偏爱、稳定的优先级和不怕别人知道的认真，最容易让你心软。",
    fear: "你最怕自己只是对方众多可能性中的一个，却已经交出了最认真的部分。",
    fit: "适合你的人会把偏爱说清，也会在选择有成本时继续用行动确认。"
  },
  "repair-nurturer": {
    title: "总想把关系照顾好的人",
    hook: "你相信爱不是永远不出问题，而是问题出现后两个人都愿意留下来处理。",
    contradiction: "你很会理解对方，却容易把自己的委屈也一起解释掉。",
    attraction: "你会被有责任感、愿意沟通，并且能看见你付出的人打动。",
    fear: "你最怕最后只剩自己在维持关系，对方把你的体谅当成理所当然。",
    fit: "适合你的人不仅接受你的照顾，也会主动照顾你，不让修复永远只由你发起。"
  },
  "push-pull": {
    title: "越心动越装作不在意的人",
    hook: "你不是没有感觉，而是越在意，越想先确认自己不会成为更容易受伤的那一个。",
    contradiction: "你需要亲密，却又害怕自己先表现得太需要，所以常常一边等待靠近，一边准备退出。",
    attraction: "让你真正陷进去的，通常是既有吸引力，又能持续给出安全感的人。",
    fear: "你最怕自己刚放下防备，对方就开始后退，于是会提前把情绪收起来。",
    fit: "适合你的人情绪稳定、愿意解释，不会靠忽冷忽热维持吸引力。"
  }
};

const meterValue = (meters, id) => Number(meters?.[id] ?? 50);

const buildMoves = (meters) => {
  const approach = meterValue(meters, "approach");
  const clarity = meterValue(meters, "clarity");
  const romance = meterValue(meters, "romance");
  const judgment = meterValue(meters, "judgment");
  const securityNeed = meterValue(meters, "securityNeed");
  const expression = meterValue(meters, "expression");
  const boundary = meterValue(meters, "boundary");
  const longterm = meterValue(meters, "longterm");

  let heart;
  if (romance >= 63 && judgment >= 63) heart = "会被气氛和细节打动，但会继续看这些好意能不能持续。";
  else if (romance >= 63) heart = "容易记住氛围、暗号和只属于两个人的细节。";
  else if (judgment >= 63) heart = "真正让你动心的，是稳定兑现，而不是一时热烈。";
  else heart = "你通常要相处一阵，心动才会在熟悉里慢慢长出来。";

  let near;
  if (approach >= 64 && expression >= 62) near = "有感觉时会给出信号，也愿意在关键处把话说清。";
  else if (approach >= 64) near = "你会主动制造下一次见面，但仍会保留一点退路。";
  else if (expression >= 62) near = "你未必先走近，却会在关系重要时直接确认。";
  else near = "你会先观察对方是否持续靠近，再决定自己给多少回应。";

  let protect;
  if (boundary >= 64 && securityNeed >= 64) protect = "你表面守着边界，心里却很在意对方有没有交代。";
  else if (boundary >= 64) protect = "一旦察觉关系失衡，你会先把投入慢慢收回来。";
  else if (securityNeed >= 64) protect = "突然失联、态度变淡和不解释，最容易让你不安。";
  else if (clarity >= 64) protect = "你会通过问清关系和计划，让自己不必一直猜。";
  else protect = "你通常愿意先沟通，不会因为一次波动立刻离开。";

  let stay;
  if (longterm >= 66 && clarity >= 60) stay = "确认彼此以后，你会把对方放进真实生活和未来安排。";
  else if (longterm >= 66) stay = "你一旦认真，投入往往比表面看起来更长久。";
  else if (boundary >= 66) stay = "你愿意认真，但前提是关系不会吞掉各自的生活。";
  else stay = "你更看重当下是否真实舒服，不会过早许诺很远的未来。";

  return [
    { id: "heart", title: "怎么心动", text: heart },
    { id: "near", title: "怎么靠近", text: near },
    { id: "protect", title: "怎么自保", text: protect },
    { id: "stay", title: "怎么留下", text: stay }
  ];
};

export function buildMemoryProfile(archetype, meters, resultsSpec) {
  const configured = resultsSpec.memoryProfiles?.[archetype.id] ?? {};
  const fallback = DEFAULT_PROFILES[archetype.id] ?? {
    title: archetype.title.replace(/型$/, "的人"),
    hook: archetype.tagline,
    contradiction: "你在靠近和保护自己之间，有一套只属于自己的节奏。",
    attraction: "真正能打动你的，是对方持续表现出的认真。",
    fear: "你最怕关系里的投入和回应长期不对等。",
    fit: "适合你的人会尊重你的节奏，也愿意给出清楚、稳定的回应。"
  };
  const profile = { ...fallback, ...configured };
  const secondaryTitle = archetype.secondary?.title?.replace(/型$/, "") ?? null;

  return {
    title: profile.title,
    hook: profile.hook,
    label: secondaryTitle
      ? `底层倾向 · ${archetype.title.replace(/型$/, "")} × ${secondaryTitle}`
      : `底层倾向 · ${archetype.title.replace(/型$/, "")}`,
    contradiction: {
      title: "你最矛盾的地方",
      text: profile.contradiction
    },
    insights: [
      { id: "attraction", title: "你会被什么打动", text: profile.attraction },
      { id: "fear", title: "你在关系里最怕什么", text: profile.fear },
      { id: "fit", title: "真正适合你的人", text: profile.fit }
    ],
    moves: buildMoves(meters)
  };
}
