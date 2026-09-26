// From shared/src/net/protocol.ts in the (private) Stashout repo.
// Floats never go on the wire raw. The map is 768 m square, so 16 bits gives
// ~11.7 mm of position resolution; aim is 12 bits over a full turn.
//
// The client canonicalizes its aim through quantAngle -> dequantAngle BEFORE
// simulating with it, so the value it predicts with is bit-identical to what
// the server decodes. Without that, every reconciliation replay would be
// slightly wrong.

const POS_BITS = 16;
const POS_MAX = (1 << POS_BITS) - 1;
const ANGLE_BITS = 12;
const ANGLE_STEPS = 1 << ANGLE_BITS;
const TWO_PI = Math.PI * 2;

export function quantPos(v: number): number {
  return Math.round((clamp(v, 0, WORLD_SIZE) / WORLD_SIZE) * POS_MAX);
}

export function dequantPos(q: number): number {
  return (q / POS_MAX) * WORLD_SIZE;
}

export function quantAngle(a: number): number {
  let n = a % TWO_PI;
  if (n < 0) n += TWO_PI;
  return Math.round((n / TWO_PI) * ANGLE_STEPS) % ANGLE_STEPS;
}

export function dequantAngle(q: number): number {
  return (q / ANGLE_STEPS) * TWO_PI;
}

/** Round an angle to exactly what the receiver will decode. */
export function canonAngle(a: number): number {
  return dequantAngle(quantAngle(a));
}

// Used like this when encoding a player's input (one of 87 message kinds):
//   w.writeBits(quantAngle(inp.aim), ANGLE_BITS);
// and a snapshot position:
//   w.writeBits(quantPos(msg.x), POS_BITS);
//   w.writeBits(quantPos(msg.y), POS_BITS);
