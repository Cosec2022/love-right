
const HOME_SLOGAN = "先经历一段爱情，再看清自己是谁。";

function normalize(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function fetchCatalog() {
  return fetch(`./stories/catalog.json?ts=${Date.now()}`)
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);
}

function getHeroRoot() {
  const headings = [...document.querySelectorAll("h1, h2, h3, .hero-title, .home-hero h1")];
  const target = headings.find((el) => normalize(el.textContent).toLowerCase() === "love right");
  return target ? target.closest("section, article, main > div, .panel, .hero, .home-hero, .entry-card, .intro-card") : null;
}

function tuneHeroCopy() {
  const hero = getHeroRoot();
  if (!hero) return;
  hero.classList.add("lr-home-hero");
  const paras = [...hero.querySelectorAll("p")].filter((el) => normalize(el.textContent).length >= 14);
  if (!paras.length) return;
  const primary = paras.find((el) => /问卷|关系|可复用引擎|选择/.test(el.textContent)) || paras[0];
  primary.textContent = HOME_SLOGAN;
  primary.classList.add("lr-home-slogan");
  paras.forEach((el) => {
    if (el !== primary && /可复用引擎|记录靠近|犹豫|边界|确认爱|问卷/.test(el.textContent)) {
      el.remove();
    }
  });
  hero.querySelectorAll(".story-content-badges, .story-inline-badges").forEach((el) => {
    if (hero.contains(el)) el.remove();
  });
}

function findStoryCards() {
  return [...document.querySelectorAll("button, article, section, div")]
    .filter((node) => {
      const kicker = node.querySelector?.(".entry-kicker");
      const title = node.querySelector?.("h2, h3");
      return kicker && title && /story/i.test(kicker.textContent);
    });
}

function deriveMetaRow(card) {
  const targetChip = [...card.querySelectorAll("*")].find((el) => normalize(el.textContent) === "空间结果");
  if (targetChip && targetChip.parentElement) return targetChip.parentElement;
  const audienceChip = [...card.querySelectorAll("*")].find((el) => /[男女]性视角/.test(normalize(el.textContent)));
  if (audienceChip && audienceChip.parentElement) return audienceChip.parentElement;
  return null;
}

function cleanupWrongBadges(card, keepRow) {
  card.querySelectorAll(".story-content-badges, .story-inline-badges").forEach((el) => {
    if (keepRow && keepRow.contains(el)) return;
    el.remove();
  });
}

function badgeSpecs(story) {
  const ids = Array.isArray(story.contentBadges)
    ? story.contentBadges
    : story.contentBadge
    ? [story.contentBadge]
    : [];
  return ids.map((id) => {
    if (id === "forbidden-romance") {
      return { label: "禁忌之恋", cls: "story-inline-badge--forbidden" };
    }
    if (id === "adult-18-plus") {
      return { label: "18+ 成人限定", cls: "story-inline-badge--adult" };
    }
    return null;
  }).filter(Boolean);
}

function attachInlineBadges(card, story) {
  const row = deriveMetaRow(card);
  if (!row) return;
  cleanupWrongBadges(card, row);
  let container = row.querySelector(".story-inline-badges");
  if (!container) {
    container = document.createElement("div");
    container.className = "story-inline-badges";
    row.appendChild(container);
  }
  container.innerHTML = "";
  badgeSpecs(story).forEach((spec) => {
    const badge = document.createElement("span");
    badge.className = `story-inline-badge ${spec.cls}`;
    badge.textContent = spec.label;
    container.appendChild(badge);
  });
  if (!container.children.length) container.remove();
}

function storyKey(card) {
  const kicker = normalize(card.querySelector(".entry-kicker")?.textContent || "");
  const title = normalize(card.querySelector("h2, h3")?.textContent || "");
  return { kicker, title };
}

function applyCardMetadata(catalog) {
  if (!catalog?.stories?.length) return;
  const cards = findStoryCards();
  cards.forEach((card) => {
    const { kicker, title } = storyKey(card);
    const story = catalog.stories.find((item) =>
      normalize(item.series) === kicker || normalize(item.title) === title
    );
    if (!story) return;
    card.dataset.storyAudience = story.audience || "";
    card.dataset.storyId = story.id || "";
    attachInlineBadges(card, story);
  });
  installAudienceFilter(cards);
}

function installAudienceFilter(cards) {
  if (!cards.length) return;
  if (document.querySelector(".story-audience-filter")) return;
  const hero = getHeroRoot();
  const anchor = hero?.parentElement || cards[0]?.parentElement;
  const listRoot = cards[0]?.parentElement;
  if (!anchor || !listRoot) return;

  const wrap = document.createElement("div");
  wrap.className = "story-audience-filter";
  wrap.innerHTML = `
    <span class="story-audience-filter__label">筛选故事</span>
    <div class="story-audience-filter__buttons">
      <button type="button" class="story-audience-filter__button is-active" data-filter="all">全部</button>
      <button type="button" class="story-audience-filter__button" data-filter="female">女性向</button>
      <button type="button" class="story-audience-filter__button" data-filter="male">男性向</button>
    </div>
  `;
  if (hero && hero.parentElement) {
    hero.insertAdjacentElement("afterend", wrap);
  } else {
    listRoot.insertAdjacentElement("beforebegin", wrap);
  }

  const apply = (filter) => {
    wrap.querySelectorAll(".story-audience-filter__button").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.filter === filter);
    });
    cards.forEach((card) => {
      const audience = card.dataset.storyAudience || "female";
      const show = filter === "all" || filter === audience;
      card.style.display = show ? "" : "none";
    });
  };

  wrap.addEventListener("click", (event) => {
    const btn = event.target.closest(".story-audience-filter__button");
    if (!btn) return;
    apply(btn.dataset.filter || "all");
  });
}

function stripResearchLabels(root = document) {
  const nodes = [...root.querySelectorAll("span, strong, b, em, div, p, li")];
  nodes.forEach((el) => {
    if (el.children.length) return;
    const text = normalize(el.textContent);
    if (!text) return;
    if (/^\d{1,3}\s*[低中高]$/.test(text)) {
      el.textContent = text.replace(/\s*[低中高]$/, "");
      return;
    }
    if (/^\d{1,3}\/100\s*[低中高]$/.test(text)) {
      el.textContent = text.replace(/\s*[低中高]$/, "");
      return;
    }
    if (/^[^\n]{1,14}\s+\d{1,3}\s*[低中高]$/.test(text)) {
      el.textContent = text.replace(/\s([低中高])$/, "");
    }
  });
}

let catalogPromise;
function boot() {
  document.body.classList.add("lr-home-ui-tuned");
  tuneHeroCopy();
  stripResearchLabels();
  catalogPromise = catalogPromise || fetchCatalog().then((catalog) => {
    applyCardMetadata(catalog);
    return catalog;
  });
}

const observer = new MutationObserver(() => {
  tuneHeroCopy();
  stripResearchLabels();
  if (catalogPromise) {
    catalogPromise.then((catalog) => applyCardMetadata(catalog));
  } else {
    catalogPromise = fetchCatalog().then((catalog) => {
      applyCardMetadata(catalog);
      return catalog;
    });
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
observer.observe(document.documentElement, { childList: true, subtree: true });
