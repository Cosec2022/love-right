import { resolveConditionalTarget } from "./condition-evaluator.js";

const clone = (value) => {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const makeSessionId = () => {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
      stateVersion: 1,
      storyId: this.story.id,
      storySchemaVersion: this.story.schemaVersion,
      sessionId: makeSessionId(),
      currentSceneId: this.story.initialScene,
      answers: [],
      rawTraits: Object.fromEntries((this.story.space?.axes ?? this.story.traits ?? []).map((trait) => [trait.id, 0])),
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
    return saved;
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

  getCurrentScene() {
    const scene = this.scenes.get(this.state.currentSceneId);
    if (!scene) throw new Error(`Unknown scene: ${this.state.currentSceneId}`);
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
      answers: this.state.answers,
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
    const answer = {
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
      answeredAt: Date.now()
    };
    this.state.answers.push(answer);

    for (const axis of this.story.space?.axes ?? this.story.traits ?? []) {
      this.state.rawTraits[axis.id] ??= 0;
      this.state.rawTraits[axis.id] += answer.vector?.[axis.id] ?? 0;
    }
    Object.assign(this.state.flags, choice.setFlags ?? {});
    for (const flag of choice.unsetFlags ?? []) delete this.state.flags[flag];
    if (choice.outcome) this.state.outcome = choice.outcome;

    const target = resolveConditionalTarget(choice.next ?? scene.next, this.buildContext());
    if (!target) throw new Error(`No next target from ${scene.id}/${choice.id}`);

    this.onEvent("choice_selected", {
      storyId: this.story.id,
      sessionId: this.state.sessionId,
      sceneId: scene.id,
      slot: scene.slot,
      choiceId: choice.id
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
