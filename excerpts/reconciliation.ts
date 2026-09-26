// From client/src/game.ts in the (private) Stashout repo. The method is
// unmodified; the class around it is omitted.
//
// PREDICTION: the client runs the same shared sim the server runs, one input
//   per tick, immediately. Your own movement never waits for the network.
//
// RECONCILIATION: every snapshot carries ackSeq (the last input the server
//   applied). Drop acked inputs, reset to the server's authoritative position,
//   and replay the remaining pending inputs on top. Because the sim is
//   deterministic, if the server agreed with us the replay lands exactly where
//   we already were and nothing visibly changes. Any remaining difference is
//   real disagreement (packet loss, rate limiting), folded into a decaying
//   render offset so it looks like a nudge, not a teleport.
//
// INTERPOLATION: remote players render INTERP_DELAY_MS (100 ms) in the past,
//   lerped between the two snapshots bracketing that moment. The server's lag
//   compensation accounts for that delay when they shoot at you.

  private reconcile(sx: number, sy: number, hp: number, alive: boolean, ackSeq: number, layer: number): void {
    const p = this.predicted!;
    this.ghost = { x: sx, y: sy };

    // Server outcomes we never predict: health and death. Diff before adopting
    // so our own body voices its hits/death like everyone else's (healing only
    // raises hp, so a drop is always damage).
    if (this.onBodyHit !== null && p.alive) {
      if (!alive) this.onBodyHit(p.x, p.y, true);
      else if (hp < p.hp) this.onBodyHit(p.x, p.y, false);
    }
    p.hp = hp;
    if (alive !== p.alive) {
      // Died or respawned — adopt the server state wholesale, drop everything.
      p.alive = alive;
      p.x = sx;
      p.y = sy;
      p.layer = layer;
      this.prevX = sx;
      this.prevY = sy;
      this.pending.length = 0;
      this.errX = this.errY = 0;
      return;
    }

    while (this.pending.length > 0 && this.pending[0]!.input.seq <= ackSeq) {
      this.pending.shift();
    }

    const oldX = p.x;
    const oldY = p.y;
    p.x = sx;
    p.y = sy;
    // Adopt the authoritative layer BEFORE the replay: each replayed movement
    // step re-runs the stair transition from this base, so the predicted layer
    // lands back exactly where the local prediction already had it (the same
    // deterministic-replay contract as position).
    p.layer = layer;
    // Replay against the CURRENT remote positions (we have no per-tick history
    // of them). Body collision is a soft push and only bites on contact, so any
    // small mismatch with the server self-corrects on the next snapshot.
    const bodies = this.solidBodies();
    // Combat isn't replayed, so p.fireSlowLeft is the LIVE counter (post-newest
    // tick). Hand each step the value it originally ran with, then put the live
    // one back — a replay must not rewrite combat's state, only re-derive
    // position from it (see PlayerState.fireSlowLeft).
    const liveFireSlow = p.fireSlowLeft;
    for (const e of this.pending) {
      p.fireSlowLeft = e.fireSlow;
      stepPlayerMovement(p, e.input, TICK_DT, TEST_MAP, this.doorStates, this.furnStates, this.adminSpeed, bodies);
    }
    p.fireSlowLeft = liveFireSlow;
    // Collapse the interpolation base onto the reconciled spot; errX/errY carry
    // the visual delta so a render before the next tick doesn't glide oddly.
    this.prevX = p.x;
    this.prevY = p.y;

    // How far did the correction move us? (Sub-centimeter = quantization noise.)
    const dx = oldX - p.x;
    const dy = oldY - p.y;
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > 0.02) {
      this.corrections++;
      this.lastCorrectionMag = mag;
    }
    if (mag < 2) {
      // Hide it: keep rendering from the old spot and let the offset decay.
      this.errX += dx;
      this.errY += dy;
    } else {
      this.errX = this.errY = 0; // huge desync — snap, don't glide
    }
  }
