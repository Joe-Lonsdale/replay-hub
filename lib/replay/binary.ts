export class ReplayReader {
  private offset = 0;
  private readonly view: DataView;

  constructor(private readonly buf: Uint8Array) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  get position(): number {
    return this.offset;
  }

  remaining(): number {
    return this.buf.length - this.offset;
  }

  i32(): number {
    this.need(4);
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  u32(): number {
    this.need(4);
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  u64(): bigint {
    this.need(8);
    const value = this.view.getBigUint64(this.offset, true);
    this.offset += 8;
    return value;
  }

  f32(): number {
    this.need(4);
    const value = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return value;
  }

  bytes(length: number): Uint8Array {
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
      return latin1(raw.subarray(0, end));
    }
    const chars = -length;
    if (chars > 1_000_000) throw new Error(`UTF-16 length ${chars} is implausible`);
    const raw = this.bytes(chars * 2);
    const keep = Math.max(0, chars - 1);
    return utf16le(raw.subarray(0, keep * 2));
  }

  private need(length: number): void {
    if (this.offset + length > this.buf.length) {
      throw new Error(
        `Replay ended early at byte ${this.offset}, needed ${length} more bytes`,
      );
    }
  }
}

function latin1(bytes: Uint8Array): string {
  let out = "";
  const codes: number[] = [];
  for (let index = 0; index < bytes.length; index += 1) {
    codes.push(bytes[index]);
    if (codes.length === 8192) {
      out += String.fromCharCode(...codes);
      codes.length = 0;
    }
  }
  if (codes.length) out += String.fromCharCode(...codes);
  return out;
}

function utf16le(bytes: Uint8Array): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let out = "";
  const codes: number[] = [];
  for (let index = 0; index + 1 < bytes.byteLength; index += 2) {
    codes.push(view.getUint16(index, true));
    if (codes.length === 8192) {
      out += String.fromCharCode(...codes);
      codes.length = 0;
    }
  }
  if (codes.length) out += String.fromCharCode(...codes);
  return out;
}
