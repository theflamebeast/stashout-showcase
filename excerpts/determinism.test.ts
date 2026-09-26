// From shared/test/determinism.test.ts in the (private) Stashout repo.
// The run() helper and the first two of 13 cases, unmodified.

/** Run the full sim (movement + combat + projectiles) over an input script. */
function run(inputs: PlayerInput[]): { player: PlayerState; projs: ProjectileState[] } {
  const player = makePlayer(1);
  const projs: ProjectileState[] = [];
  let nextProjId = 1;
  for (const input of inputs) {
    stepPlayerMovement(player, input, TICK_DT, TEST_MAP);
    if (tickPlayerCombat(player, input)) {
      for (const dir of shotDirections(player)) {
        projs.push(spawnProjectile(nextProjId++, player, dir, TEST_MAP));
      }
    }
    for (let i = projs.length - 1; i >= 0; i--) {
      if (!stepProjectile(projs[i]!, TICK_DT, TEST_MAP).alive) projs.splice(i, 1);
    }
  }
  return { player, projs };
}

describe("sim determinism", () => {
  it("same inputs produce bit-identical state", () => {
    const inputs = randomInputs(0xc0ffee, 2000);
    const a = run(inputs);
    const b = run(inputs);
    // toEqual is not enough — we need exact bit equality, so compare via Object.is
    expect(Object.is(a.player.x, b.player.x)).toBe(true);
    expect(Object.is(a.player.y, b.player.y)).toBe(true);
    expect(a.player.shotCount).toBe(b.player.shotCount);
    expect(a.projs.length).toBe(b.projs.length);
    for (let i = 0; i < a.projs.length; i++) {
      expect(Object.is(a.projs[i]!.x, b.projs[i]!.x)).toBe(true);
      expect(Object.is(a.projs[i]!.y, b.projs[i]!.y)).toBe(true);
    }
  });

  it("replaying a suffix of inputs from a mid-run state matches the straight run (reconciliation invariant)", () => {
    // This is exactly what the client does on every snapshot: take the
    // server's authoritative state at tick N, replay inputs N+1.. on top,
    // and expect to land on the same prediction it already had.
    const inputs = randomInputs(0xbeef, 600);
    const full = makePlayer(1);
    for (const input of inputs) stepPlayerMovement(full, input, TICK_DT, TEST_MAP);

    const mid = makePlayer(1);
    for (const input of inputs.slice(0, 300)) stepPlayerMovement(mid, input, TICK_DT, TEST_MAP);
    // "snapshot" of mid-state, then replay the rest (deep-copy the ammo record)
    const replayed: PlayerState = { ...mid, ammo: { ...mid.ammo } };
    for (const input of inputs.slice(300)) stepPlayerMovement(replayed, input, TICK_DT, TEST_MAP);

    expect(Object.is(replayed.x, full.x)).toBe(true);
    expect(Object.is(replayed.y, full.y)).toBe(true);
  });
  // ...11 more cases in the real file
});
