const el = (id) => document.getElementById(id);

const appendParagraphs = (container, paragraphs) => {
  container.replaceChildren();
  for (const text of paragraphs) {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    container.appendChild(paragraph);
  }
};

export class Renderer {
  constructor() {
    this.screenIds = ["libraryScreen", "startScreen", "quizScreen", "resultScreen", "errorScreen"];
  }

  show(screenId) {
    for (const id of this.screenIds) el(id).classList.toggle("active", id === screenId);
    el("libraryBtn").hidden = screenId === "libraryScreen";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  renderCatalog(catalog, onSelect) {
    const list = el("storyList");
    list.replaceChildren();
    for (const story of catalog.stories.filter((item) => item.status === "published")) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "story-entry";
      button.innerHTML = `
        <span class="entry-kicker"></span>
        <h2></h2>
        <p></p>
        <span class="entry-meta">
          <span class="engine-badge">${story.estimatedMinutes ?? 8} 分钟</span>
          <span class="engine-badge">${story.audience === "male" ? "男性视角" : "女性视角"}</span>
          <span class="engine-badge">空间结果</span>
        </span>`;
      button.querySelector(".entry-kicker").textContent = story.series;
      button.querySelector("h2").textContent = story.title;
      button.querySelector("p").textContent = story.description;
      button.addEventListener("click", () => onSelect(story));
      list.appendChild(button);
    }
    if (!list.children.length) {
      list.innerHTML = '<div class="card loading-card">故事正在写作中。</div>';
    }
    this.show("libraryScreen");
  }

  renderStart(story, state) {
    el("storySeries").textContent = story.metadata.series;
    el("storyTitle").textContent = story.metadata.title;
    el("storySubtitle").textContent = story.metadata.subtitle;
    el("storyTitleMini").textContent = story.metadata.title;
    el("storyTags").replaceChildren(...story.metadata.tags.map((tag) => {
      const span = document.createElement("span");
      span.className = "topic";
      span.textContent = tag;
      return span;
    }));

    const hasProgress = state.answers.length > 0;
    el("startBtn").textContent = state.complete ? "查看我的结果" : hasProgress ? `继续第 ${state.answers.length + 1} 幕` : "走进故事";
    el("resetProgressBtn").hidden = !hasProgress && !state.complete;
    el("startNote").textContent = `跟着第一反应选择。进度只保存在本机。${story.metadata.disclaimer}`;
    document.title = `${story.metadata.title}｜Love Right`;
    this.show("startScreen");
  }

  renderScene(scene, progress, canGoBack, onChoice) {
    el("progressBar").style.width = `${progress.percent}%`;
    el("progressText").textContent = `${progress.current} / ${progress.total}`;
    el("chapter").textContent = scene.chapter;
    el("question").textContent = scene.prompt;
    el("sceneNote").textContent = scene.note ?? "";
    el("backBtn").style.visibility = canGoBack ? "visible" : "hidden";

    const sceneCopy = el("sceneCopy");
    sceneCopy.replaceChildren();
    for (const block of scene.content ?? []) {
      const node = document.createElement(block.type === "quote" ? "blockquote" : "p");
      if (block.type === "continuity") node.className = "continuity-line";
      node.textContent = block.text;
      sceneCopy.appendChild(node);
    }

    const options = el("options");
    options.replaceChildren();
    scene.choices.forEach((choice, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option";
      const key = document.createElement("span");
      key.className = "option-key";
      key.textContent = String.fromCharCode(65 + index);
      const main = document.createElement("span");
      main.className = "option-main";
      main.append(document.createTextNode(choice.text));
      if (choice.subtext) {
        const sub = document.createElement("span");
        sub.className = "option-sub";
        sub.textContent = choice.subtext;
        main.appendChild(sub);
      }
      button.append(key, main);
      button.addEventListener("click", () => onChoice(choice.id));
      options.appendChild(button);
    });
    this.show("quizScreen");
  }

  renderResult(result, story) {
    el("resultTitle").textContent = result.memory.title;
    el("resultTagline").textContent = result.memory.hook;
    el("resultLabel").textContent = result.memory.label;

    el("endingStoryTitle").textContent = story.metadata.title;
    appendParagraphs(el("endingCopy"), result.ending);

    el("contradictionTitle").textContent = result.memory.contradiction.title;
    el("contradictionCopy").textContent = result.memory.contradiction.text;

    el("insightGrid").replaceChildren(...result.memory.insights.map((item, index) => {
      const card = document.createElement("article");
      card.className = "insight-card";
      card.dataset.no = `0${index + 1}`;
      const title = document.createElement("h3");
      title.textContent = item.title;
      const copy = document.createElement("p");
      copy.textContent = item.text;
      card.append(title, copy);
      return card;
    }));

    el("emotionIndexGrid").replaceChildren(...result.memory.indices.map((item) => {
      const card = document.createElement("article");
      card.className = "emotion-index-card";
      card.dataset.level = item.value >= 64 ? "high" : item.value <= 42 ? "low" : "middle";

      const head = document.createElement("div");
      head.className = "emotion-index-head";
      const title = document.createElement("span");
      title.textContent = item.title;
      const score = document.createElement("strong");
      score.textContent = item.value;
      head.append(title, score);

      const track = document.createElement("div");
      track.className = "emotion-index-track";
      const fill = document.createElement("div");
      fill.className = "emotion-index-fill";
      fill.style.width = "0%";
      fill.setAttribute("aria-label", `${item.title} ${item.value}`);
      track.appendChild(fill);

      const foot = document.createElement("div");
      foot.className = "emotion-index-foot";
      const level = document.createElement("span");
      level.className = "emotion-index-level";
      level.textContent = item.level;
      const copy = document.createElement("p");
      copy.textContent = item.text;
      foot.append(level, copy);

      card.append(head, track, foot);
      requestAnimationFrame(() => { fill.style.width = `${item.value}%`; });
      return card;
    }));

    el("moveList").replaceChildren(...result.memory.moves.map((item) => {
      const row = document.createElement("div");
      row.className = "move-row";
      const title = document.createElement("strong");
      title.textContent = item.title;
      const copy = document.createElement("span");
      copy.textContent = item.text;
      row.append(title, copy);
      return row;
    }));

    const evidence = el("evidenceList");
    evidence.replaceChildren();
    for (const item of result.evidence) {
      const card = document.createElement("div");
      card.className = "evidence-item";
      const title = document.createElement("strong");
      title.textContent = `${item.chapter} · ${item.choice}`;
      const meaning = document.createElement("span");
      meaning.textContent = item.meaning;
      card.append(title, meaning);
      evidence.appendChild(card);
    }

    appendParagraphs(el("psychologyCopy"), result.psychology);
    appendParagraphs(el("historyCopy"), result.history);

    el("futureGrid").innerHTML = result.future.map((item, index) => `
      <div class="story-card" data-no="0${index + 1}"><h3></h3><p></p></div>`).join("");
    [...el("futureGrid").children].forEach((card, index) => {
      card.querySelector("h3").textContent = result.future[index].title;
      card.querySelector("p").textContent = result.future[index].text;
    });

    el("matchTags").replaceChildren(...result.match.tags.map((tag) => {
      const span = document.createElement("span");
      span.className = "type-tag";
      span.textContent = tag;
      return span;
    }));
    appendParagraphs(el("matchCopy"), [result.match.text]);
    el("warningCopy").textContent = result.warning;

    const labelById = Object.fromEntries(story.traits.map((trait) => [trait.id, trait.label]));
    el("traitGrid").innerHTML = Object.entries(result.traits).map(([id, score]) => {
      const level = score >= 72 ? "高" : score <= 38 ? "低" : "中";
      return `<div class="trait-pill"><span></span><strong>${score} · ${level}</strong></div>`;
    }).join("");
    [...el("traitGrid").children].forEach((card, index) => {
      const traitId = Object.keys(result.traits)[index];
      card.querySelector("span").textContent = labelById[traitId] ?? traitId;
    });

    el("resultFooter").textContent = `${story.metadata.disclaimer} Love Right · A CosecLab Experiment`;
    this.show("resultScreen");
  }

  error(message) {
    el("errorMessage").textContent = message;
    this.show("errorScreen");
  }

  toast(message) {
    const toast = el("toast");
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1700);
  }
}
