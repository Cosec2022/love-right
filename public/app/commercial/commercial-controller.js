import { commercialApi, loadSession, saveSession } from "./api-client.js";

const TRAIT_LABELS = Object.freeze({
  approach: "靠近主动", trust: "信任开放", certainty: "确定需求", abandonment: "失去敏感",
  idealization: "浪漫投射", novelty: "新鲜吸引", discernment: "现实判断", jealousy: "比较敏感",
  expression: "表达直接", conflict: "冲突进入", repair: "关系修复", reassurance: "确认需求",
  autonomy: "自我边界", commitment: "长期投入", care: "照顾倾向", validation: "被选需求"
});

const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);
  return element;
};

const safeText = (value, limit = 200) => String(value ?? "").slice(0, limit);

export class CommercialController {
  constructor({ accountButton, resultPanel, notify, onRankingChange }) {
    this.accountButton = accountButton;
    this.resultPanel = resultPanel;
    this.notify = notify ?? (() => {});
    this.onRankingChange = onRankingChange ?? (() => {});
    this.session = loadSession();
    this.ranking = [];
    this.config = { donationUrl: "" };
    this.current = null;
    this.currentVote = 0;
    this.loginModal = null;
    this.profileModal = null;
  }

  async init() {
    this.renderAccountButton();
    const [config] = await Promise.all([
      commercialApi.config().catch(() => ({ donationUrl: "" })),
      this.refreshRanking({ notify: false })
    ]);
    this.config = config;

    if (this.session) {
      try {
        const payload = await commercialApi.me();
        this.session.user = payload.user;
        saveSession(this.session);
      } catch {
        this.clearSession();
      }
      this.renderAccountButton();
    }
  }

  rankCatalog(catalog) {
    const published = (catalog.stories ?? []).filter((story) => story.status === "published");
    const unpublished = (catalog.stories ?? []).filter((story) => story.status !== "published");
    const byId = new Map(this.ranking.map((item) => [item.storyId, item]));

    const enriched = published.map((story, index) => ({
      ...story,
      commercialRating: byId.get(story.id) ?? {
        storyId: story.id,
        upVotes: 0,
        downVotes: 0,
        totalVotes: 0,
        approvalRate: 0,
        ratingEligible: false,
        rank: published.length - index
      }
    }));

    enriched.sort((left, right) => {
      const a = left.commercialRating;
      const b = right.commercialRating;
      if (a.ratingEligible !== b.ratingEligible) return a.ratingEligible ? -1 : 1;
      if (a.ratingEligible) {
        return b.approvalRate - a.approvalRate || b.totalVotes - a.totalVotes || b.freshness - a.freshness;
      }
      const leftIndex = published.findIndex((story) => story.id === left.id);
      const rightIndex = published.findIndex((story) => story.id === right.id);
      return rightIndex - leftIndex;
    });

    return { ...catalog, stories: [...enriched, ...unpublished] };
  }

  clearResult() {
    this.current = null;
    this.currentVote = 0;
    if (this.resultPanel) {
      this.resultPanel.hidden = true;
      this.resultPanel.replaceChildren();
    }
  }

  async presentResult({ result, label, story }) {
    this.current = { result, label, story };
    this.currentVote = 0;
    this.renderResultPanel();

    if (!this.session) return;
    try {
      await this.saveCurrentResult();
      const vote = await commercialApi.myVote(story.id);
      this.currentVote = Number(vote.myVote ?? 0);
      this.renderResultPanel();
    } catch (error) {
      if (error.status === 401) this.clearSession();
      console.warn("Love Right commercial result sync failed", error);
    }
  }

  async refreshRanking({ notify = true } = {}) {
    try {
      const payload = await commercialApi.ranking();
      this.ranking = payload.stories ?? [];
      this.onRankingChange(this.ranking);
      return true;
    } catch (error) {
      if (notify) this.notify(error.message);
      return false;
    }
  }

  renderAccountButton() {
    if (!this.accountButton) return;
    this.accountButton.replaceChildren();
    const main = node("span", "account-button-main", this.session ? this.session.user.nickname : "登录");
    const sub = node("small", "account-button-sub", this.session ? "爱情档案" : "保存你的故事");
    this.accountButton.append(main, sub);
    this.accountButton.onclick = () => this.session ? this.openProfile() : this.openLogin();
  }

  clearSession() {
    saveSession(null);
    this.session = null;
    this.renderAccountButton();
    if (this.current) this.renderResultPanel();
  }

  createModal(id, title) {
    const overlay = node("div", "commercial-modal-overlay");
    overlay.id = id;
    overlay.hidden = true;
    const dialog = node("section", "commercial-modal");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", `${id}-title`);
    const head = node("header", "commercial-modal-head");
    const heading = node("h2", "", title);
    heading.id = `${id}-title`;
    const close = node("button", "commercial-modal-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "关闭");
    close.onclick = () => { overlay.hidden = true; };
    head.append(heading, close);
    const body = node("div", "commercial-modal-body");
    dialog.append(head, body);
    overlay.append(dialog);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) overlay.hidden = true;
    });
    document.body.append(overlay);
    return { overlay, body };
  }

  openLogin() {
    if (!this.loginModal) this.loginModal = this.buildLoginModal();
    this.loginModal.overlay.hidden = false;
    queueMicrotask(() => this.loginModal.overlay.querySelector("input")?.focus());
  }

  buildLoginModal() {
    const modal = this.createModal("commercialLoginModal", "进入爱情档案");
    const intro = node("p", "commercial-muted", "使用 Love ID + 昵称进入。没有密码，也不绑定手机或邮箱；知道这两项的人可以进入同一份档案，请不要使用真实姓名或敏感资料。");
    const form = node("form", "commercial-login-form");

    const idField = node("label", "commercial-field");
    idField.append(node("span", "", "Love ID"));
    const idInput = node("input");
    idInput.name = "loveId";
    idInput.autocomplete = "username";
    idInput.placeholder = "例如 LR-MOON72";
    idInput.maxLength = 24;
    idInput.required = true;
    idField.append(idInput);

    const generate = node("button", "commercial-link-button", "帮我生成一个好记的 ID");
    generate.type = "button";
    generate.onclick = () => {
      const words = ["MOON", "ROSE", "WIND", "NIGHT", "STAR", "TIDE", "MIST", "FIRE"];
      const word = words[crypto.getRandomValues(new Uint8Array(1))[0] % words.length];
      const number = String(crypto.getRandomValues(new Uint16Array(1))[0] % 10000).padStart(4, "0");
      idInput.value = `LR-${word}${number}`;
      idInput.select();
    };

    const nicknameField = node("label", "commercial-field");
    nicknameField.append(node("span", "", "昵称"));
    const nicknameInput = node("input");
    nicknameInput.name = "nickname";
    nicknameInput.autocomplete = "nickname";
    nicknameInput.placeholder = "例如 阿月";
    nicknameInput.maxLength = 20;
    nicknameInput.required = true;
    nicknameField.append(nicknameInput);

    const submit = node("button", "commercial-primary-button", "进入 / 建立档案");
    submit.type = "submit";
    form.append(idField, generate, nicknameField, submit);
    form.onsubmit = async (event) => {
      event.preventDefault();
      submit.disabled = true;
      submit.textContent = "正在进入…";
      try {
        const payload = await commercialApi.login(idInput.value, nicknameInput.value);
        this.session = { token: payload.token, user: payload.user };
        saveSession(this.session);
        this.renderAccountButton();
        modal.overlay.hidden = true;
        this.notify(`欢迎，${payload.user.nickname}`);
        if (this.current) {
          await this.saveCurrentResult();
          this.currentVote = Number((await commercialApi.myVote(this.current.story.id)).myVote ?? 0);
          this.renderResultPanel();
        }
      } catch (error) {
        this.notify(error.message);
      } finally {
        submit.disabled = false;
        submit.textContent = "进入 / 建立档案";
      }
    };
    modal.body.append(intro, form);
    return modal;
  }

  async openProfile() {
    if (!this.session) return this.openLogin();
    if (!this.profileModal) this.profileModal = this.createModal("commercialProfileModal", "我的爱情档案");
    const { overlay, body } = this.profileModal;
    body.replaceChildren(node("p", "commercial-muted", "正在读取你的故事…"));
    overlay.hidden = false;
    try {
      const profile = await commercialApi.profile();
      body.replaceChildren(this.renderProfile(profile));
    } catch (error) {
      if (error.status === 401) {
        this.clearSession();
        overlay.hidden = true;
        return this.openLogin();
      }
      body.replaceChildren(node("p", "commercial-error", error.message));
    }
  }

  renderProfile(profile) {
    const wrap = node("div", "commercial-profile");
    const hero = node("section", "commercial-profile-hero");
    hero.append(
      node("p", "commercial-eyebrow", `LOVE ID · ${safeText(profile.user.loveId)}`),
      node("h3", "", safeText(profile.user.nickname)),
      node("p", "commercial-muted", `完成 ${profile.summary.completedStories} 个故事，留下 ${profile.completions.length} 次记录`)
    );
    wrap.append(hero);

    if (profile.summary.topLabels?.length) {
      const section = node("section", "commercial-profile-section");
      section.append(node("h4", "", "反复出现的你"));
      const cloud = node("div", "commercial-label-cloud");
      for (const item of profile.summary.topLabels) {
        cloud.append(node("span", "commercial-label-chip", `${safeText(item.title, 8)} × ${item.count}`));
      }
      section.append(cloud);
      wrap.append(section);
    }

    const traits = Object.entries(profile.summary.averageTraits ?? {})
      .sort((left, right) => Math.abs(Number(right[1]) - 50) - Math.abs(Number(left[1]) - 50))
      .slice(0, 6);
    if (traits.length) {
      const section = node("section", "commercial-profile-section");
      section.append(node("h4", "", "跨故事爱情画像"));
      const grid = node("div", "commercial-trait-summary");
      for (const [id, value] of traits) {
        const card = node("div", "commercial-trait-card");
        card.append(node("span", "", TRAIT_LABELS[id] ?? id), node("strong", "", Math.round(Number(value))));
        grid.append(card);
      }
      section.append(grid, node("p", "commercial-fine-print", "样本越多，画像越稳定；它描述你在这些故事里的选择，不是心理诊断。"));
      wrap.append(section);
    }

    const timeline = node("section", "commercial-profile-section");
    timeline.append(node("h4", "", "爱情记录"));
    if (!profile.completions.length) timeline.append(node("p", "commercial-muted", "完成一个故事后，结果会保存在这里。"));
    for (const item of profile.completions) {
      const card = node("article", "commercial-history-card");
      const date = new Date(`${item.completedAt}Z`);
      card.append(
        node("time", "commercial-history-date", Number.isNaN(date.valueOf()) ? "" : date.toLocaleDateString("zh-CN")),
        node("h5", "", safeText(item.labelTitle, 8)),
        node("p", "", safeText(item.storyTitle)),
        node("p", "commercial-muted", safeText(item.resultTitle))
      );
      timeline.append(card);
    }
    wrap.append(timeline);

    const logout = node("button", "commercial-secondary-button", "退出这个 Love ID");
    logout.type = "button";
    logout.onclick = async () => {
      try { await commercialApi.logout(); } catch {}
      this.clearSession();
      this.profileModal.overlay.hidden = true;
      this.notify("已退出爱情档案");
    };
    wrap.append(logout);
    return wrap;
  }

  completionPayload() {
    if (!this.current) return null;
    const { result, label, story } = this.current;
    return {
      storyId: story.id,
      answerPath: (result.spatial?.answerMatrix ?? []).map((answer) => ({
        sceneId: answer.sceneId,
        choiceId: answer.choiceId
      }))
    };
  }

  async saveCurrentResult() {
    if (!this.session || !this.current) throw Object.assign(new Error("请先登录"), { status: 401 });
    return commercialApi.saveCompletion(this.completionPayload());
  }

  async submitVote(value) {
    if (!this.session) return this.openLogin();
    if (!this.current) return;
    try {
      await this.saveCurrentResult();
      const next = this.currentVote === value ? 0 : value;
      const payload = await commercialApi.vote(this.current.story.id, next);
      this.currentVote = Number(payload.myVote ?? 0);
      this.renderResultPanel();
      this.notify(next === 1 ? "已记下你的喜欢" : next === -1 ? "已记下你的不喜欢" : "已撤回投票");
      await this.refreshRanking({ notify: false });
    } catch (error) {
      if (error.status === 401) this.clearSession();
      this.notify(error.message);
    }
  }

  renderResultPanel() {
    if (!this.resultPanel || !this.current) return;
    const { story } = this.current;
    this.resultPanel.hidden = false;
    this.resultPanel.replaceChildren();

    const heading = node("h3", "commercial-result-heading", "这个故事，值得推荐吗？");
    const copy = node("p", "commercial-muted", this.session
      ? `你的选择会以 ${this.session.user.nickname} 的身份保存。每个 Love ID 对每篇故事只有一票。`
      : "登录后保存这次结果，并用 👍 或 👎 帮助故事排序。");
    const actions = node("div", "commercial-result-actions");

    const save = node("button", "commercial-primary-button", this.session ? "保存到爱情档案" : "登录并保存");
    save.type = "button";
    save.onclick = async () => {
      if (!this.session) return this.openLogin();
      save.disabled = true;
      try {
        await this.saveCurrentResult();
        save.textContent = "已保存";
        this.notify("结果已进入爱情档案");
      } catch (error) {
        this.notify(error.message);
      } finally {
        save.disabled = false;
      }
    };

    const votes = node("div", "commercial-vote-group");
    const up = node("button", `commercial-vote-button${this.currentVote === 1 ? " is-active" : ""}`, "👍");
    const down = node("button", `commercial-vote-button${this.currentVote === -1 ? " is-active" : ""}`, "👎");
    up.type = down.type = "button";
    up.setAttribute("aria-label", `喜欢《${story.title}》`);
    down.setAttribute("aria-label", `不喜欢《${story.title}》`);
    up.onclick = () => this.submitVote(1);
    down.onclick = () => this.submitVote(-1);
    votes.append(up, down);

    const donate = node("button", "commercial-secondary-button", this.config.donationUrl ? "打赏 Love Right" : "打赏即将开放");
    donate.type = "button";
    donate.onclick = () => {
      if (!this.config.donationUrl) return this.notify("配置收款链接后，打赏入口会自动启用");
      window.open(this.config.donationUrl, "_blank", "noopener,noreferrer");
    };

    actions.append(save, votes, donate);
    this.resultPanel.append(heading, copy, actions);
  }
}
