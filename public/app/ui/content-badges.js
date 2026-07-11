const BADGE_DEFINITIONS = Object.freeze({
  "forbidden-romance": {
    label: "禁忌之恋",
    className: "story-content-badge--forbidden"
  },
  "adult-18-plus": {
    label: "18+ 成人限定",
    className: "story-content-badge--adult"
  }
});

const TITLE_PREFIXES = Object.freeze([
  { pattern: /^\s*【禁忌之恋】\s*/u, badge: "forbidden-romance" },
  { pattern: /^\s*【(?:成人心动|成人限定|18\+|18禁)】\s*/u, badge: "adult-18-plus" }
]);

let catalogStories = [];
let scheduled = false;

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function cleanTitle(title = "") {
  let output = String(title);
  for (const { pattern } of TITLE_PREFIXES) output = output.replace(pattern, "");
  return output.trim();
}

function inferBadges(story) {
  const explicit = [
    ...asArray(story.contentBadges),
    ...asArray(story.contentBadge)
  ];

  const title = String(story.title || story.name || "");
  for (const { pattern, badge } of TITLE_PREFIXES) {
    if (pattern.test(title)) explicit.push(badge);
  }

  const rating = String(story.ageRating || story.rating || "");
  if (/\b18\s*\+|18禁/u.test(rating)) explicit.push("adult-18-plus");

  return [...new Set(explicit)].filter((key) => BADGE_DEFINITIONS[key]);
}

function escapeSelector(value) {
  if (globalThis.CSS?.escape) return globalThis.CSS.escape(String(value));
  return String(value).replace(/["\\]/g, "\\$&");
}

function findStoryCard(story) {
  const id = story.id || story.slug;
  if (id) {
    const escaped = escapeSelector(id);
    const direct = document.querySelector(
      `[data-story-id="${escaped}"], [data-story="${escaped}"], #${escaped}`
    );
    if (direct) return direct.closest("article, a, li, section, .story-card") || direct;

    const linked = [...document.querySelectorAll("a[href]")].find((node) =>
      node.getAttribute("href")?.includes(String(id))
    );
    if (linked) return linked.closest("article, li, section, .story-card") || linked;
  }

  const candidates = [String(story.title || story.name || ""), cleanTitle(story.title || story.name || "")]
    .filter(Boolean);
  const headings = document.querySelectorAll("h1, h2, h3, h4, [data-story-title]");
  for (const heading of headings) {
    const text = heading.textContent?.trim() || "";
    if (candidates.includes(text) || candidates.some((title) => text.includes(title))) {
      return heading.closest("article, a, li, section, .story-card") || heading.parentElement;
    }
  }
  return null;
}

function findKicker(card) {
  if (!card) return null;
  const preferred = card.querySelector(
    ".story-kicker, .story-eyebrow, .story-label, .card-kicker, .eyebrow, [data-story-kicker]"
  );
  if (preferred) return preferred;

  return [...card.querySelectorAll("p, span, div")].find((node) => {
    if (node.children.length) return false;
    const text = node.textContent?.trim() || "";
    return /LOVE\s+RIGHT/u.test(text) && /STORY\s*\d*/u.test(text);
  }) || null;
}

function findTitle(card, story) {
  if (!card) return null;
  const raw = String(story.title || story.name || "").trim();
  const cleaned = cleanTitle(raw);
  return [...card.querySelectorAll("h1, h2, h3, h4, [data-story-title]")].find((node) => {
    const text = node.textContent?.trim() || "";
    return text === raw || text === cleaned || text.includes(raw) || text.includes(cleaned);
  }) || null;
}

function renderBadge(key) {
  const definition = BADGE_DEFINITIONS[key];
  const badge = document.createElement("span");
  badge.className = `story-content-badge ${definition.className}`;
  badge.dataset.contentBadge = key;
  badge.textContent = definition.label;
  badge.setAttribute("aria-label", `内容标识：${definition.label}`);
  return badge;
}

function enhanceStoryCard(story) {
  const badges = inferBadges(story);
  if (!badges.length) return false;

  const card = findStoryCard(story);
  if (!card) return false;

  const title = findTitle(card, story);
  if (title) {
    const cleaned = cleanTitle(title.textContent || "");
    if (cleaned) title.textContent = cleaned;
  }

  const kicker = findKicker(card);
  if (!kicker) return false;

  let row = kicker.closest(".story-card-kicker-row");
  if (!row) {
    row = document.createElement("div");
    row.className = "story-card-kicker-row";
    kicker.parentNode?.insertBefore(row, kicker);
    row.appendChild(kicker);
  }

  let container = row.querySelector(".story-content-badges");
  if (!container) {
    container = document.createElement("span");
    container.className = "story-content-badges";
    row.appendChild(container);
  }

  for (const key of badges) {
    if (!container.querySelector(`[data-content-badge="${escapeSelector(key)}"]`)) {
      container.appendChild(renderBadge(key));
    }
  }

  card.dataset.contentBadgesReady = "true";
  return true;
}

function applyBadges() {
  scheduled = false;
  if (!catalogStories.length) return;
  for (const story of catalogStories) enhanceStoryCard(story);
}

function scheduleApply() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(applyBadges);
}

async function loadCatalog() {
  const url = new URL("./stories/catalog.json", document.baseURI);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load story catalog: ${response.status}`);
  const catalog = await response.json();
  catalogStories = Array.isArray(catalog) ? catalog : (catalog.stories || catalog.items || []);
  scheduleApply();
}

function startObserver() {
  const observer = new MutationObserver(scheduleApply);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

startObserver();
loadCatalog().catch((error) => {
  console.warn("[Love Right] Story content badges were not loaded.", error);
});
