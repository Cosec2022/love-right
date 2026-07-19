export const RATING_THRESHOLD = 7;

function inputError(message) {
  throw Object.assign(new Error(message), { status: 400 });
}

export function normalizeLoveId(value) {
  return String(value ?? "").trim().toUpperCase();
}

export function validateIdentity(loveId, nickname) {
  const id = normalizeLoveId(loveId);
  const name = String(nickname ?? "").trim();
  if (!/^[A-Z0-9][A-Z0-9_-]{3,23}$/.test(id)) {
    inputError("Love ID 需为 4–24 位英文字母、数字、- 或 _");
  }
  if ([...name].length < 1 || [...name].length > 20 || /[\u0000-\u001f\u007f]/.test(name)) {
    inputError("昵称需为 1–20 个可见字符");
  }
  return { loveId: id, nickname: name };
}

export function validateStoryId(value) {
  const storyId = String(value ?? "").toLowerCase();
  if (!/^story-\d{2,4}$/.test(storyId)) inputError("故事 ID 无效");
  return storyId;
}

export function sortStoryRanking(stories, stats) {
  const byId = new Map(stats.map((row) => [row.story_id, row]));
  return stories.map((story, index) => {
    const row = byId.get(story.id) ?? {};
    const upVotes = Number(row.up_votes ?? 0);
    const downVotes = Number(row.down_votes ?? 0);
    const totalVotes = upVotes + downVotes;
    return {
      storyId: story.id,
      title: story.title,
      upVotes,
      downVotes,
      totalVotes,
      approvalRate: totalVotes ? upVotes / totalVotes : 0,
      ratingEligible: totalVotes >= RATING_THRESHOLD,
      freshness: index
    };
  }).sort((a, b) => {
    if (a.ratingEligible !== b.ratingEligible) return a.ratingEligible ? -1 : 1;
    if (a.ratingEligible) {
      return b.approvalRate - a.approvalRate || b.totalVotes - a.totalVotes || b.freshness - a.freshness;
    }
    return b.freshness - a.freshness;
  }).map((item, index) => ({ ...item, rank: index + 1 }));
}

export function aggregateCompletions(completions) {
  const labelCounts = new Map();
  const uniqueStories = new Set();
  const traitTotals = new Map();
  const traitCounts = new Map();

  for (const item of completions) {
    uniqueStories.add(item.story_id);
    labelCounts.set(item.label_id, {
      id: item.label_id,
      title: item.label_title,
      count: (labelCounts.get(item.label_id)?.count ?? 0) + 1
    });
    try {
      const traits = JSON.parse(item.traits_json ?? "{}");
      for (const [key, raw] of Object.entries(traits)) {
        const value = Number(raw);
        if (!Number.isFinite(value)) continue;
        traitTotals.set(key, (traitTotals.get(key) ?? 0) + value);
        traitCounts.set(key, (traitCounts.get(key) ?? 0) + 1);
      }
    } catch {}
  }

  const averageTraits = Object.fromEntries([...traitTotals].map(([key, total]) => [
    key,
    Number((total / traitCounts.get(key)).toFixed(1))
  ]));

  return {
    completedStories: uniqueStories.size,
    topLabels: [...labelCounts.values()]
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
      .slice(0, 6),
    averageTraits
  };
}
