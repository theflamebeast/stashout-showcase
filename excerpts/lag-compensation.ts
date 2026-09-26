// From server/src/room.ts in the (private) Stashout repo. Three pieces of the
// same class, unmodified, with the code between them omitted.
//
// A shooter sees targets INTERP_DELAY_MS (100 ms) in the past plus half their
// round trip. So when a bullet is tested against a player, the server rewinds
// that player to where the shooter actually saw them, capped at
// MAX_REWIND_TICKS (8 ticks, ~267 ms at 30 Hz) so a victim can't be hit long
// after reaching cover. AI are tested at their present position: they don't
// perceive interpolation delay.

const HISTORY_LEN = 32; // ~1s of position history for lag compensation

interface HistoryEntry {
  tick: number;
  x: number;
  y: number;
  alive: boolean;
}

// ---- how far back this shooter's bullets rewind ----

  /** Ticks of rewind this shooter gets: half RTT + interpolation delay, capped. */
  private rewindFor(player: ServerPlayer): number {
    const ms = player.rttMs / 2 + INTERP_DELAY_MS;
    return Math.min(MAX_REWIND_TICKS, Math.max(0, Math.round(ms / TICK_MS)));
  }

  private rewoundPosition(
    target: ServerPlayer,
    tick: number,
  ): { x: number; y: number } | null {
    const entry = target.history[((tick % HISTORY_LEN) + HISTORY_LEN) % HISTORY_LEN];
    if (entry !== null && entry !== undefined && entry.tick === tick) {
      return entry.alive ? { x: entry.x, y: entry.y } : null;
    }
    // No history that far back (fresh join / very first ticks): use present.
    return target.state.alive ? { x: target.state.x, y: target.state.y } : null;
  }

// ---- inside the per-tick projectile step: the hit test uses the rewound position ----

      for (const target of this.players.values()) {
        if (!target.inRaid || target.state.id === proj.state.ownerId) continue;
        if (target.state.layer !== projLayer) continue;
        const pos = this.rewoundPosition(target, this.tick - proj.rewindTicks);
        if (pos === null) continue;
        const t = segmentVsCircle(res.x0, res.y0, res.dx, res.dy, pos.x, pos.y, hitRadius);
        if (t !== null && t < hitT) {
          hitT = t;
          hitPlayer = target;
        }
      }
      // AI are hit at their present position — no rewind, an AI doesn't
      // perceive interpolation delay.
