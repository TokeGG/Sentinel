// Optional ambient audio (off by default): soft generated brown noise via
// WebAudio, no files, no network. start()/stop() only on the user's toggle.
let ctx: AudioContext | null = null;

export function startAmbient(volume = 0.05) {
  if (ctx) return;
  ctx = new AudioContext();
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.connect(gain).connect(ctx.destination);
  src.start();
}
export function stopAmbient() {
  ctx?.close().catch(() => {});
  ctx = null;
}
