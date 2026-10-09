import { describe, expect, it } from "vitest";
import { encodeWav, encodeWavBytes, wavFileName } from "./wavEncoder";

const source = (channels: number[][], sampleRate = 48000) => ({
  numberOfChannels: channels.length,
  sampleRate,
  length: channels[0].length,
  getChannelData: (index: number) => Float32Array.from(channels[index]),
});

describe("encodeWav", () => {
  it("writes a 16-bit PCM header and interleaved, clipped samples", () => {
    const pcm = source([[0, 1, -1], [0.5, 2, -2]]);
    const blob = encodeWav(pcm);
    const view = new DataView(encodeWavBytes(pcm));
    const tag = (offset: number) =>
      String.fromCharCode(...new Uint8Array(view.buffer, offset, 4));

    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(44 + 3 * 2 * 2);
    expect(view.byteLength).toBe(blob.size);
    expect([tag(0), tag(8), tag(12), tag(36)]).toEqual(["RIFF", "WAVE", "fmt ", "data"]);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(12);
    const samples = Array.from({ length: 6 }, (_, i) => view.getInt16(44 + i * 2, true));
    expect(samples).toEqual([0, 16383, 32767, 32767, -32768, -32768]);
  });
});

describe("wavFileName", () => {
  it("slugifies the parts", () => {
    expect(wavFileName("Lo-Fi Dreams!", "Take 2")).toBe("lo-fi-dreams-take-2.wav");
    expect(wavFileName("???")).toBe("take.wav");
  });
});
