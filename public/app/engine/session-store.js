export class SessionStore {
  constructor(prefix = "love-right:session") {
    this.prefix = prefix;
  }

  key(storyId) {
    return `${this.prefix}:${storyId}`;
  }

  load(storyId) {
    try {
      const value = localStorage.getItem(this.key(storyId));
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  save(storyId, state) {
    try {
      localStorage.setItem(this.key(storyId), JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  clear(storyId) {
    try {
      localStorage.removeItem(this.key(storyId));
    } catch {
      // Storage may be disabled. The in-memory session still works.
    }
  }
}
