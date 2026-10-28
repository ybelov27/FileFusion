/*
 * MP3 encoding with lamejs (LAME in JavaScript). Loaded on demand.
 */
import { Mp3Encoder } from "@breezystack/lamejs";

const FRAME = 1152; // samples per MP3 frame

function toInt16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/** Encodes decoded audio as a stereo (or mono) MP3 at the given bitrate. */
export async function audioBufferToMp3(
  audio: AudioBuffer,
  kbps = 192,
): Promise<Blob> {
  const channels = Math.min(audio.numberOfChannels, 2);
  const left = toInt16(audio.getChannelData(0));
  const right = channels === 2 ? toInt16(audio.getChannelData(1)) : undefined;
  const encoder = new Mp3Encoder(channels, audio.sampleRate, kbps);
  const parts: Uint8Array[] = [];
  for (let i = 0; i < left.length; i += FRAME) {
    const chunk = encoder.encodeBuffer(
      left.subarray(i, i + FRAME),
      right?.subarray(i, i + FRAME),
    );
    if (chunk.length) parts.push(chunk);
    // Yield every ~5 seconds of audio so long files don't freeze the page.
    if (i % (FRAME * 200) === 0)
      await new Promise((resolve) => setTimeout(resolve));
  }
  parts.push(encoder.flush());
  return new Blob(parts as BlobPart[], { type: "audio/mpeg" });
}
