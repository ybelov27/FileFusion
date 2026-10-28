/*
 * Audio decoding with the Web Audio API, encoded as 16-bit PCM WAV.
 */

export async function decodeAudio(file: Blob): Promise<AudioBuffer> {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error("Your browser cannot decode audio.");
  const ctx = new Ctx();
  try {
    return await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error("This audio format could not be decoded by your browser.");
  } finally {
    void ctx.close();
  }
}

export function audioBufferToWav(audio: AudioBuffer): Blob {
  const ch = audio.numberOfChannels;
  const len = audio.length;
  const rate = audio.sampleRate;
  const buf = new ArrayBuffer(44 + len * ch * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) =>
    [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + len * ch * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * ch * 2, true);
  v.setUint16(32, ch * 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, len * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, c) => audio.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (const data of chans) {
      const smp = Math.max(-1, Math.min(1, data[i]!));
      v.setInt16(o, smp < 0 ? smp * 0x8000 : smp * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([buf], { type: "audio/wav" });
}
