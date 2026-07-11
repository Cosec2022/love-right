export class AnalyticsClient {
  constructor({ endpoint = null, consent = false } = {}) {
    this.endpoint = endpoint;
    this.consent = consent;
  }

  track(type, payload = {}) {
    if (!this.endpoint || !this.consent) return;
    const body = JSON.stringify({ type, payload, occurredAt: new Date().toISOString() });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(this.endpoint, new Blob([body], { type: "application/json" }));
      } else {
        fetch(this.endpoint, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
      }
    } catch {
      // Analytics must never block the story.
    }
  }
}
