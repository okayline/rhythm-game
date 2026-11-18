// The day's sound: the drums are recorded samples (public/samples, CC0), the day's pick of each kit's recordings, loaded
// with the day's beat for the count-in and your taps; the music is the track (samples/tracks/, made with Stable Audio 3).
// Everything plays into one bus: a dry path and a reverb (a room made from decaying noise, its
// size set by the kit), glued by a compressor on the way out.
import { KIT_DRUMS, HAT_RATE } from "./beat.js";

const TRACK_LEVEL = 0.8;   // the track's volume (the tap and count-in samples play at 0.5 to 0.9)
const ROOMS ={ "hip-hop": [0.6, 0.16], house: [0.9, 0.14], bounce: [0.8, 0.12], "tech-house": [0.6, 0.1] };   // [seconds of tail, how much]

function makeBus(ctx, day) {
  const [secs, amount] = ROOMS[day.style], len = Math.floor(ctx.sampleRate * secs), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
  const room = ctx.createConvolver(), wet = ctx.createGain(), glue = ctx.createDynamicsCompressor();
  room.buffer = ir; wet.gain.value = amount;
  glue.threshold.value = -18; glue.ratio.value = 3;
  const bus = ctx.createGain();
  bus.connect(glue); bus.connect(room); room.connect(wet); wet.connect(glue); glue.connect(ctx.destination);
  return bus;
}

async function loadSamples(ctx, day) {
  const samples = {};
  const files = [...KIT_DRUMS[day.style].map((d) => [d, `samples/${day.style}/${d}-${day.voice[d] + 1}.wav`])];
  if (day.track) files.push(["track", `samples/tracks/${day.track.file}`]);
  await Promise.all(files.map(async ([d, url]) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(d);
    samples[d] = await ctx.decodeAudioData(await r.arrayBuffer());
  }));
  return samples;
}

// `day` is the day's beat (its style and voice). Returns { ctx, sample(kind, time, volume), heardLate() }: the context
// starts paused (browsers need a tap first); heardLate() is the device's output delay in seconds, which a tap's time has
// taken off (what Bluetooth headphones add, for one), where the browser reports it.
export async function createAudio(day) {
  const ctx = new AudioContext(), bus = makeBus(ctx, day), samples = await loadSamples(ctx, day);
  const sample = (kind, t, vol = 0.9) => {
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = samples[kind]; g.gain.value = vol;
    if (kind === "hat" || kind === "open") src.playbackRate.value = HAT_RATE[day.style];
    src.connect(g).connect(bus); src.start(t);
  };
  // The track (Stable Audio music, exactly 8 measures long): starts at `from` on its beat 1, loops seamlessly, and fades
  // out over FADE seconds ending at `until`. It skips the room (it has its own).
  const track = (from, until) => {
    if (!samples.track) return;
    const src = ctx.createBufferSource(), g = ctx.createGain(), FADE = 0.3;
    src.buffer = samples.track; src.loop = true;
    g.gain.setValueAtTime(TRACK_LEVEL, from);
    g.gain.setValueAtTime(TRACK_LEVEL, until - FADE);
    g.gain.linearRampToValueAtTime(0, until);
    src.connect(g).connect(ctx.destination); src.start(from); src.stop(until);
  };
  return { ctx, sample, track, heardLate: () => (ctx.baseLatency || 0) + (ctx.outputLatency || 0) };
}
