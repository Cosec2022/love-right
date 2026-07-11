import { evaluateCondition, resolveConditionalTarget } from "./condition-evaluator.js";

const clone = (value) => {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const makeSessionId = () => {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const RELATIONSHIP_KEYS = ["warmth", "trust", "guard", "hurt", "tension", "repair"];
const emptyRelationship = () => Object.fromEntries(RELATIONSHIP_KEYS.map((key) => [key, 0]));
const clamp = (value, min = -12, max = 12) => Math.min(max, Math.max(min, Number(value) || 0));

const deriveRelationship = (answer) => {
  const v = answer.vector ?? {};
  const context = answer.context ?? "general";
  const derived = {
    warmth: 0.58 * (v.approach ?? 0) + 0.28 * (v.idealization ?? 0) + 0.22 * (v.care ?? 0),
    trust: 0.58 * (v.trust ?? 0) + 0.24 * (v.repair ?? 0) + 0.16 * (v.expression ?? 0) - 0.18 * (v.jealousy ?? 0),
    guard: 0.52 * (v.autonomy ?? 0) + 0.34 * (v.discernment ?? 0) - 0.34 * (v.approach ?? 0),
    hurt: 0.40 * (v.abandonment ?? 0) + 0.28 * (v.reassurance ?? 0) + 0.24 * (v.jealousy ?? 0) - 0.20 * (v.repair ?? 0),
    tension: 0.42 * (v.conflict ?? 0) + 0.26 * (v.jealousy ?? 0) - 0.24 * (v.repair ?? 0),
    repair: 0.52 * (v.repair ?? 0) + 0.24 * (v.expression ?? 0) + 0.12 * (v.trust ?? 0) - 0.10 * (v.autonomy ?? 0)
  };
  if (context === "rupture") derived.tension += 0.22;
  if (context === "jealousy") derived.hurt += 0.14;
  return Object.fromEntries(Object.entries(derived).map(([key, value]) => [key, Number(value.toFixed(3))]));
};

const rebuildRelationship = (answers = []) => {
  const relationship = emptyRelationship();
  for (const answer of answers) {
    const delta = answer.relationship ?? deriveRelationship(answer);
    for (const key of RELATIONSHIP_KEYS) relationship[key] = clamp(relationship[key] + (delta[key] ?? 0));
  }
  return relationship;
};

export class StoryEngine {
  constructor(story, { store, onEvent } = {}) {
    this.story = story;
    this.store = store;
    this.onEvent = onEvent ?? (() => {});
    this.scenes = new Map(story.scenes.map((scene) => [scene.id, scene]));
    this.totalSlots = new Set(story.scenes.map((scene) => scene.slot)).size;
    this.state = this.restore() ?? this.createInitialState();
  }

  createInitialState() {
    return {
      stateVersion: 2,
      storyId: this.story.id,
      storySchemaVersion: this.story.schemaVersion,
      sessionId: makeSessionId(),
      currentSceneId: this.story.initialScene,
      answers: [],
      rawTraits: Object.fromEntries((this.story.space?.axes ?? this.story.traits ?? []).map((trait) => [trait.id, 0])),
      relationship: emptyRelationship(),
      pendingAftermath: null,
      flags: {},
      visited: [this.story.initialScene],
      outcome: null,
      complete: false,
      startedAt: null,
      updatedAt: Date.now(),
      history: []
    };
  }

  restore() {
    const saved = this.store?.load(this.story.id);
    if (!saved) return null;
    if (saved.storyId !== this.story.id || saved.storySchemaVersion !== this.story.schemaVersion) return null;
    if (!this.scenes.has(saved.currentSceneId)) return null;
    return {
      ...saved,
      stateVersion: 2,
      relationship: saved.relationship ?? rebuildRelationship(saved.answers),
      pendingAftermath: saved.pendingAftermath ?? null,
      history: saved.history ?? []
    };
  }

  save() {
    this.state.updatedAt = Date.now();
    this.store?.save(this.story.id, this.state);
  }

  reset() {
    this.store?.clear(this.story.id);
    this.state = this.createInitialState();
    this.onEvent("story_reset", { storyId: this.story.id, sessionId: this.state.sessionId });
    return this.state;
  }

  start() {
    if (!this.state.startedAt) {
      this.state.startedAt = Date.now();
      this.save();
      this.onEvent("story_started", { storyId: this.story.id, sessionId: this.state.sessionId });
    }
    return this.getCurrentScene();
  }

  hasProgress() {
    return this.state.answers.length > 0 || this.state.complete;
  }

  resolveSceneVariant(scene) {
    const resolved = clone(scene);
    const context = this.buildContext();
    for (const variant of scene.variants ?? []) {
      if (!evaluateCondition(variant.when, context)) continue;
      if (variant.content) resolved.content = clone(variant.content);
      if (variant.prependContent) resolved.content = [...clone(variant.prependContent), ...(resolved.content ?? [])];
      if (variant.appendContent) resolved.content = [...(resolved.content ?? []), ...clone(variant.appendContent)];
      if (variant.prompt) resolved.prompt = variant.prompt;
      if (variant.note !== undefined) resolved.note = variant.note;
      break;
    }
    return resolved;
  }

  getCurrentScene() {
    const raw = this.scenes.get(this.state.currentSceneId);
    if (!raw) throw new Error(`Unknown scene: ${this.state.currentSceneId}`);
    const scene = this.resolveSceneVariant(raw);
    if (this.state.pendingAftermath?.targetSceneId === raw.id) {
      scene.content = [
        { type: "continuity", text: this.state.pendingAftermath.text },
        ...(scene.content ?? [])
      ];
    }
    return scene;
  }

  snapshot() {
    const { history, ...state } = this.state;
    return clone(state);
  }

  buildContext() {
    return {
      flags: this.state.flags,
      rawTraits: this.state.rawTraits,
      relationship: this.state.relationship,
      answers: this.state.answers,
      lastAnswer: this.state.answers.at(-1) ?? null,
      outcome: this.state.outcome,
      visited: this.state.visited
    };
  }

  choose(choiceId) {
    if (this.state.complete) throw new Error("The story is already complete.");
    const scene = this.getCurrentScene();
    const choice = scene.choices.find((item) => item.id === choiceId);
    if (!choice) throw new Error(`Unknown choice ${choiceId} in ${scene.id}`);

    this.state.history.push(this.snapshot());
    const draftAnswer = {
      sceneId: scene.id,
      slot: scene.slot,
      chapter: scene.chapter,
      choiceId: choice.id,
      choiceText: choice.text,
      vector: clone(choice.vector ?? choice.effects ?? {}),
      context: choice.context ?? scene.context ?? "general",
      intensity: choice.intensity ?? 1,
      confidence: choice.confidence ?? 1,
      cross: clone(choice.cross ?? []),
      effects: clone(choice.effects ?? choice.vector ?? {}),
      outcome: choice.outcome ?? null,
      aftermath: choice.aftermath ?? null,
      answeredAt: Date.now()
    };
    const derived = deriveRelationship(draftAnswer);
    draftAnswer.relationship = { ...derived, ...(choice.relationship ?? {}) };
    const answer = draftAnswer;
    this.state.answers.push(answer);

    for (const axis of this.story.space?.axes ?? this.story.traits ?? []) {
      this.state.rawTraits[axis.id] ??= 0;
      this.state.rawTraits[axis.id] += answer.vector?.[axis.id] ?? 0;
    }
    for (const key of RELATIONSHIP_KEYS) {
      this.state.relationship[key] = clamp(this.state.relationship[key] + (answer.relationship?.[key] ?? 0));
    }
    Object.assign(this.state.flags, choice.setFlags ?? {});
    for (const flag of choice.unsetFlags ?? []) delete this.state.flags[flag];
    if (choice.outcome) this.state.outcome = choice.outcome;

    const target = resolveConditionalTarget(choice.next ?? scene.next, this.buildContext());
    if (!target) throw new Error(`No next target from ${scene.id}/${choice.id}`);

    this.state.pendingAftermath = choice.aftermath && target !== "$result"
      ? { text: choice.aftermath, sourceSceneId: scene.id, targetSceneId: target }
      : null;

    this.onEvent("choice_selected", {
      storyId: this.story.id,
      sessionId: this.state.sessionId,
      sceneId: scene.id,
      slot: scene.slot,
      choiceId: choice.id,
      relationship: clone(answer.relationship)
    });

    if (target === "$result") {
      this.state.complete = true;
      this.onEvent("story_completed", {
        storyId: this.story.id,
        sessionId: this.state.sessionId,
        answers: this.state.answers.length,
        durationMs: this.state.startedAt ? Date.now() - this.state.startedAt : null
      });
    } else {
      if (!this.scenes.has(target)) throw new Error(`Next scene does not exist: ${target}`);
      this.state.currentSceneId = target;
      this.state.visited.push(target);
    }
    this.save();
    return this.state.complete ? null : this.getCurrentScene();
  }

  back() {
    const previous = this.state.history.pop();
    if (!previous) return false;
    const remainingHistory = this.state.history;
    this.state = { ...previous, history: remainingHistory };
    this.save();
    this.onEvent("story_back", {
      storyId: this.story.id,
      sessionId: this.state.sessionId,
      sceneId: this.state.currentSceneId
    });
    return true;
  }

  getProgress() {
    const scene = this.getCurrentScene();
    return {
      current: scene.slot,
      total: this.totalSlots,
      percent: Math.round((scene.slot / this.totalSlots) * 100)
    };
  }
}
