import {
  aggregateCompletions,
  sortStoryRanking,
  validateIdentity,
  validateStoryId
} from "./lib/core.js";
import { StoryEngine } from "../public/app/engine/story-engine.js";
import { ScoreEngine } from "../public/app/engine/score-engine.js";
import { ResultEngine } from "../public/app/engine/result-engine.js";
import { selectFourCharacterLabel } from "../public/app/commercial/label-engine.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};
const SESSION_DAYS = 180;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

async function readJson(request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 65536) throw Object.assign(new Error("请求内容过大"), { status: 413 });
  return request.json().catch(() => {
    throw Object.assign(new Error("请求格式无效"), { status: 400 });
  });
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

async function loadJsonAsset(request, env, pathname, message) {
  const assetRequest = new Request(new URL(pathname, request.url), { method: "GET" });
  const response = await env.ASSETS.fetch(assetRequest);
  if (!response.ok) throw Object.assign(new Error(message), { status: 500 });
  return response.json();
}

async function loadCatalog(request, env) {
  return loadJsonAsset(request, env, "/stories/catalog.json", "故事目录读取失败");
}

async function verifyCompletion(request, env, story, answerPath) {
  if (!Array.isArray(answerPath) || answerPath.length !== 18) {
    throw Object.assign(new Error("故事选择记录必须完整包含 18 次选择"), { status: 400 });
  }

  const storyPath = `/${String(story.storyUrl).replace(/^\.\//, "")}`;
  const resultsPath = `/${String(story.resultsUrl).replace(/^\.\//, "")}`;
  const [storySpec, resultsSpec] = await Promise.all([
    loadJsonAsset(request, env, storyPath, "故事内容读取失败"),
    loadJsonAsset(request, env, resultsPath, "故事结果配置读取失败")
  ]);
  if (storySpec.id !== story.id || resultsSpec.storyId !== story.id) {
    throw Object.assign(new Error("故事内容包不匹配"), { status: 500 });
  }

  const engine = new StoryEngine(storySpec);
  engine.start();
  try {
    for (const step of answerPath) {
      const scene = engine.getCurrentScene();
      const sceneId = String(step?.sceneId ?? "");
      const choiceId = String(step?.choiceId ?? "");
      if (scene.id !== sceneId) throw new Error(`选择路径在 ${sceneId || "未知场景"} 断开`);
      engine.choose(choiceId);
    }
  } catch (caught) {
    throw Object.assign(new Error(caught?.message ?? "选择路径无效"), { status: 400 });
  }
  if (!engine.state.complete || engine.state.answers.length !== 18) {
    throw Object.assign(new Error("故事选择记录未抵达结局"), { status: 400 });
  }

  const result = new ResultEngine(storySpec, resultsSpec, new ScoreEngine(storySpec)).build(engine.state);
  const label = selectFourCharacterLabel(result);
  return { result, label };
}

async function requireUser(request, env) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw Object.assign(new Error("请先登录"), { status: 401 });
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(`
    SELECT u.love_id, u.nickname
    FROM sessions s
    JOIN users u ON u.love_id = s.love_id
    WHERE s.token_hash = ? AND s.expires_at > datetime('now')
  `).bind(tokenHash).first();
  if (!row) throw Object.assign(new Error("登录已失效，请重新进入"), { status: 401 });
  return { loveId: row.love_id, nickname: row.nickname, tokenHash };
}

async function login(request, env) {
  const body = await readJson(request);
  const identity = validateIdentity(body.loveId, body.nickname);
  const existing = await env.DB.prepare("SELECT love_id, nickname FROM users WHERE love_id = ?")
    .bind(identity.loveId).first();

  if (existing && existing.nickname !== identity.nickname) {
    return error("这个 Love ID 已存在，但昵称不一致", 409);
  }

  if (!existing) {
    await env.DB.prepare("INSERT INTO users (love_id, nickname) VALUES (?, ?)")
      .bind(identity.loveId, identity.nickname).run();
  } else {
    await env.DB.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE love_id = ?")
      .bind(identity.loveId).run();
  }

  const token = randomToken();
  const tokenHash = await sha256(token);
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
  await env.DB.prepare(`
    INSERT INTO sessions (token_hash, love_id, expires_at)
    VALUES (?, ?, datetime('now', ?))
  `).bind(tokenHash, identity.loveId, `+${SESSION_DAYS} days`).run();

  return json({ token, user: identity });
}

async function logout(request, env) {
  const user = await requireUser(request, env);
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(user.tokenHash).run();
  return json({ ok: true });
}

async function saveCompletion(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  const storyId = validateStoryId(body.storyId);
  const catalog = await loadCatalog(request, env);
  const story = (catalog.stories ?? []).find((item) => item.id === storyId && item.status === "published");
  if (!story) return error("故事不存在或尚未发布", 404);

  const { result, label } = await verifyCompletion(request, env, story, body.answerPath);
  const traitsJson = JSON.stringify(result.traits ?? {});
  const answerPathJson = JSON.stringify(body.answerPath);
  const fingerprint = await sha256(`${storyId}|${answerPathJson}`);

  await env.DB.prepare(`
    INSERT OR IGNORE INTO completions (
      love_id, story_id, story_title, label_id, label_title, label_hook,
      archetype_id, outcome, result_title, traits_json, result_fingerprint
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    user.loveId, storyId, story.title, label.id, label.title, label.hook,
    result.archetype?.id ?? "", result.outcome ?? "", result.memory?.title ?? "", traitsJson, fingerprint
  ).run();

  return json({
    ok: true,
    verified: true,
    result: { labelId: label.id, labelTitle: label.title, outcome: result.outcome ?? "" }
  });
}

async function getVote(request, env, storyIdRaw) {
  const user = await requireUser(request, env);
  const storyId = validateStoryId(storyIdRaw);
  const row = await env.DB.prepare("SELECT vote FROM story_votes WHERE love_id = ? AND story_id = ?")
    .bind(user.loveId, storyId).first();
  return json({ myVote: Number(row?.vote ?? 0) });
}

async function vote(request, env, storyIdRaw) {
  const user = await requireUser(request, env);
  const storyId = validateStoryId(storyIdRaw);
  const body = await readJson(request);
  const value = Number(body.vote);
  if (![1, -1, 0].includes(value)) return error("投票值无效");

  const completed = await env.DB.prepare(
    "SELECT 1 AS ok FROM completions WHERE love_id = ? AND story_id = ? LIMIT 1"
  ).bind(user.loveId, storyId).first();
  if (!completed) return error("完成这个故事后才可以投票", 403);

  if (value === 0) {
    await env.DB.prepare("DELETE FROM story_votes WHERE love_id = ? AND story_id = ?")
      .bind(user.loveId, storyId).run();
  } else {
    await env.DB.prepare(`
      INSERT INTO story_votes (love_id, story_id, vote, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(love_id, story_id)
      DO UPDATE SET vote = excluded.vote, updated_at = datetime('now')
    `).bind(user.loveId, storyId, value).run();
  }
  return json({ ok: true, myVote: value });
}

async function ranking(request, env) {
  const catalog = await loadCatalog(request, env);
  const stats = await env.DB.prepare(`
    SELECT story_id,
      SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END) AS up_votes,
      SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END) AS down_votes
    FROM story_votes
    GROUP BY story_id
  `).all();
  const stories = (catalog.stories ?? []).filter((item) => item.status === "published");
  return json({ threshold: 7, stories: sortStoryRanking(stories, stats.results ?? []) });
}

async function profile(request, env) {
  const user = await requireUser(request, env);
  const rows = await env.DB.prepare(`
    SELECT story_id, story_title, label_id, label_title, label_hook,
      archetype_id, outcome, result_title, traits_json, completed_at
    FROM completions
    WHERE love_id = ?
    ORDER BY completed_at DESC, id DESC
    LIMIT 200
  `).bind(user.loveId).all();
  const completions = rows.results ?? [];
  return json({
    user: { loveId: user.loveId, nickname: user.nickname },
    summary: aggregateCompletions(completions),
    completions: completions.map((item) => ({
      storyId: item.story_id,
      storyTitle: item.story_title,
      labelId: item.label_id,
      labelTitle: item.label_title,
      labelHook: item.label_hook,
      archetypeId: item.archetype_id,
      outcome: item.outcome,
      resultTitle: item.result_title,
      completedAt: item.completed_at
    }))
  });
}

async function handleApi(request, env, url) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    return json({ ok: true, version: "1.0.0-beta.3" });
  }
  if (request.method === "GET" && url.pathname === "/api/config") {
    return json({ donationUrl: env.DONATION_URL ?? "" });
  }
  if (!env.DB) return error("数据库尚未绑定", 503);

  if (request.method === "POST" && url.pathname === "/api/auth/login") return login(request, env);
  if (request.method === "POST" && url.pathname === "/api/auth/logout") return logout(request, env);
  if (request.method === "GET" && url.pathname === "/api/me") {
    const user = await requireUser(request, env);
    return json({ user: { loveId: user.loveId, nickname: user.nickname } });
  }
  if (request.method === "POST" && url.pathname === "/api/completions") return saveCompletion(request, env);
  if (request.method === "GET" && url.pathname === "/api/profile") return profile(request, env);
  if (request.method === "GET" && url.pathname === "/api/stories/ranking") return ranking(request, env);

  const voteMatch = url.pathname.match(/^\/api\/votes\/(story-\d{2,4})$/);
  if (request.method === "GET" && voteMatch) return getVote(request, env, voteMatch[1]);
  if (request.method === "PUT" && voteMatch) return vote(request, env, voteMatch[1]);
  return error("接口不存在", 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env, url);
      return env.ASSETS.fetch(request);
    } catch (caught) {
      console.error(caught);
      return error(caught?.message ?? "服务器暂时不可用", caught?.status ?? 500);
    }
  }
};
