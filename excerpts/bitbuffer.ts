// From shared/src/net/bitbuffer.ts in the (private) Stashout repo. Unmodified.

// Minimal bit-packing primitives for the wire format. LSB-first within each
// byte. Values are written/read as unsigned ints of a fixed bit width;
// floats never go on the wire raw — they're quantized (see protocol.ts).

export class BitWriter {
  private buf: Uint8Array;
  private bitPos = 0;

  constructor(capacityBytes = 512) {
    this.buf = new Uint8Array(capacityBytes);
  }

  /**
   * Write `bits` (1..32) of `value` as unsigned. Throws if the value doesn't
   * fit — encoders are expected to quantize/clamp first, so an overflow here
   * is a protocol bug, not bad user data.
   */
  writeBits(value: number, bits: number): void {
    if (bits < 1 || bits > 32) throw new RangeError(`bits out of range: ${bits}`);
    value = value >>> 0;
    if (bits < 32 && value >= 2 ** bits) {
      throw new RangeError(`value ${value} does not fit in ${bits} bits`);
    }

    const needed = (this.bitPos + bits + 7) >> 3;
    if (needed > this.buf.length) {
      const next = new Uint8Array(Math.max(needed, this.buf.length * 2));
      next.set(this.buf);
      this.buf = next;
    }

    for (let i = 0; i < bits; i++) {
      if ((value >>> i) & 1) {
        this.buf[this.bitPos >> 3]! |= 1 << (this.bitPos & 7);
      }
      this.bitPos++;
    }
  }

  writeBool(b: boolean): void {
    this.writeBits(b ? 1 : 0, 1);
  }

  finish(): Uint8Array {
    return this.buf.slice(0, (this.bitPos + 7) >> 3);
  }
}

export class BitReader {
  private bitPos = 0;

  constructor(private readonly buf: Uint8Array) {}

  readBits(bits: number): number {
    if (bits < 1 || bits > 32) throw new RangeError(`bits out of range: ${bits}`);
    if (this.bitPos + bits > this.buf.length * 8) {
      throw new RangeError("read past end of buffer");
    }
    let value = 0;
    for (let i = 0; i < bits; i++) {
      const bit = (this.buf[this.bitPos >> 3]! >>> (this.bitPos & 7)) & 1;
      value |= bit << i;
      this.bitPos++;
    }
    return value >>> 0;
  }

  readBool(): boolean {
    return this.readBits(1) === 1;
  }
}
