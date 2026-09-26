// From client/src/net.ts in the (private) Stashout repo. Unmodified.
//
// Netcode tested only on localhost is netcode that hasn't been tested. Any
// client can be started with simulated latency, jitter and packet loss in BOTH
// directions:  /?lag=100&jitter=20&loss=0.02
// The headless raid driver passes the same query string, so automated checks
// can run the real game under bad network conditions.

  private send(bytes: Uint8Array): void {
    this.delay(() => {
      if (this.open && this.ws.readyState === WebSocket.OPEN) this.ws.send(bytes);
    });
  }

  private delay(fn: () => void): void {
    if (this.lag.lagMs === 0 && this.lag.jitterMs === 0 && this.lag.loss === 0) {
      fn();
      return;
    }
    if (Math.random() < this.lag.loss) return; // dropped
    const ms = this.lag.lagMs / 2 + Math.random() * this.lag.jitterMs;
    setTimeout(fn, ms);
  }
}

export function lagParamsFromUrl(): LagParams {
  const q = new URLSearchParams(location.search);
  return {
    lagMs: Number(q.get("lag") ?? 0) || 0,
    jitterMs: Number(q.get("jitter") ?? 0) || 0,
    loss: Number(q.get("loss") ?? 0) || 0,
  };
}
