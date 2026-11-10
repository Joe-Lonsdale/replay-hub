export class ReplayReader {
  private offset = 0;

  constructor(private readonly buf: Buffer) {}

  get position(): number {
    return this.offset;
  }

  remaining(): number {
    return this.buf.length - this.offset;
  }

  i32(): number {
    this.need(4);
    const value = this.buf.readInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  u32(): number {
    this.need(4);
    const value = this.buf.readUInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  u64(): bigint {
    this.need(8);
    const value = this.buf.readBigUInt64LE(this.offset);
    this.offset += 8;
    return value;
  }

  f32(): number {
    this.need(4);
    const value = this.buf.readFloatLE(this.offset);
    this.offset += 4;
    return value;
  }

  bytes(length: number): Buffer {
    if (length < 0) throw new Error(`Negative read of ${length} bytes at ${this.offset}`);
    this.need(length);
    const slice = this.buf.subarray(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }

  text(): string {
    const length = this.i32();
    if (length === 0) return "";
    if (length > 0) {
      if (length > 1_000_000) throw new Error(`String length ${length} is implausible`);
      const raw = this.bytes(length);
      const end = raw.length > 0 && raw[raw.length - 1] === 0 ? raw.length - 1 : raw.length;
      return raw.subarray(0, end).toString("latin1");
    }
    const chars = -length;
    if (chars > 1_000_000) throw new Error(`UTF-16 length ${chars} is implausible`);
    const raw = this.bytes(chars * 2);
    const keep = Math.max(0, chars - 1);
    return raw.subarray(0, keep * 2).toString("utf16le");
  }

  private need(length: number): void {
    if (this.offset + length > this.buf.length) {
      throw new Error(
        `Replay ended early at byte ${this.offset}, needed ${length} more bytes`,
      );
    }
  }
}
