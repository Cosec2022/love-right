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
          <span class="engine-badge">互动分支</span>
          <span class="engine-badge">动态结果</span>
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
    el("resultTitle").textContent = result.archetype.title;
    el("resultTagline").textContent = result.archetype.tagline;
    appendParagraphs(el("endingCopy"), result.ending);
    appendParagraphs(el("psychologyCopy"), result.psychology);
    appendParagraphs(el("historyCopy"), result.history);

    const labels = Object.fromEntries(result.meterDefinitions.map((meter) => [meter.id, meter.label]));
    el("meterGrid").innerHTML = Object.entries(result.meters).map(([id, score]) => `
      <div class="meter-card">
        <div class="meter-head"><span>${labels[id] ?? id}</span><span>${score}</span></div>
        <div class="meter-track"><div class="meter-fill" data-score="${score}"></div></div>
      </div>`).join("");

    const evidence = el("evidenceList");
    evidence.replaceChildren();
    for (const item of result.evidence) {
      const card = document.createElement("div");
      card.className = "evidence-item";
      const title = document.createElement("strong");
      title.textContent = `${item.chapter} · ${item.choice}`;
      const influence = document.createElement("span");
      influence.textContent = item.influence || "这次选择影响了整体关系模式。";
      card.append(title, influence);
      evidence.appendChild(card);
    }

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
    requestAnimationFrame(() => setTimeout(() => {
      document.querySelectorAll(".meter-fill").forEach((node) => {
        node.style.width = `${node.dataset.score}%`;
      });
    }, 80));
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
