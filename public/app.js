// The daily page: tap beat 4 of every measure of the track (a Stable Audio tech-house track, TRACK in beat.js). The day
// (and its kit, for the tap and count-in sounds) comes from Beat Fighter's song of the day, through /api/today.
// The song plays LOOPS times after a one-measure count-in. One button: a tap is timed in beats from the song's first
// beat on the Web Audio clock, less the device's output delay (audio.js), and moved by your tap timing. Each beat 4 is
// graded (score.js: perfect within 35 ms, good within 80 ms) once it is out of reach of a late tap. Nothing is saved
// except your tap timing, in this browser.
// The lane (a canvas) scrolls the coming beats right to left past a line, with a dot on every beat 4.
import { beat, TAP, CLAPS, MEASURES, TRACK } from "./beat.js";
import { createAudio } from "./audio.js";
import { grade, PERFECT, WINDOW } from "./score.js";

const $ = (id) => document.getElementById(id);
const LOOPS = 2;
const KICK_LATE = 0.020;   // the kicks on 1, 2, 3 play this many seconds after the beat, to sit on the track's kicks (by ear)

// Tap timing: ms added to every tap (positive counts your taps later), set by calibrating. Kept in this browser only.
let offset = 0;
try { offset = Number(localStorage.getItem("rg-offset")) || 0; } catch {}
const showOffset = () => { $("offsetVal").textContent = `Your timing: ${offset > 0 ? "+" : ""}${offset} ms`; };
showOffset();

let day, audio = null, spb = 0, t0 = 0, raf = 0, token = 0, taps = [], results = [], lates = [], cal = null;
// every beat 4 across the whole run, in beats from the first beat
const targets = Array.from({ length: LOOPS }, (_, l) => CLAPS.map((at) => l * MEASURES * 4 + at)).flat();
const END = LOOPS * MEASURES * 4;

// Calibrating: a hi-hat on every beat for CAL_BEATS beats at today's tempo; you tap along. The first CAL_SKIP taps are
// ignored, the rest are timed against their nearest beat, and the average (sign flipped) becomes the offset. Taps more
// than CAL_SPREAD ms apart from each other are too uneven to use.
const CAL_BEATS = 12, CAL_SKIP = 4, CAL_SPREAD = 100;
async function calibrate() {
  stop(); reset();
  const my = ++token;
  $("cal").textContent = "Stop";
  let a;
  try { a = await createAudio(day); } catch { if (my === token) { stop(); $("status").textContent = "Today's drums didn't load. Reload the page to try again."; } return; }
  if (my !== token) { try { a.ctx.close(); } catch {} return; }
  audio = a; try { await a.ctx.resume(); } catch {}
  spb = 60 / TRACK.bpm; t0 = a.ctx.currentTime + 0.4; cal = [];
  for (let i = 0; i < CAL_BEATS; i++) a.sample("hat", t0 + i * spb, i % 4 === 0 ? 0.9 : 0.6);
  $("call").className = "call you"; $("call").textContent = "Tap along"; $("pad").textContent = "Tap to Calibrate!";
  const frame = () => {
    if (!audio || my !== token) return;
    const b = now();
    lamps(b, CAL_BEATS);
    if (b < CAL_BEATS + 0.5) { raf = requestAnimationFrame(frame); return; }
    const used = cal.slice(CAL_SKIP);
    const spread = used.length ? Math.max(...used) - Math.min(...used) : Infinity;
    if (used.length < 4 || spread > CAL_SPREAD) $("call").textContent = "Too uneven, try again";
    else {
      offset = -Math.round(used.reduce((x, y) => x + y, 0) / used.length);
      try { localStorage.setItem("rg-offset", String(offset)); } catch {}
      showOffset(); $("call").textContent = "Calibrated!";
    }
    $("call").className = "call"; cal = null; stop();
  };
  frame();
}

const lamps = (b, end) => { for (let i = 0; i < 4; i++) $("l" + i).classList.toggle("on", b >= 0 && b < end && Math.floor(b % 4) === i); };

// The lane: 6 beats ahead of the line and 4 behind. Every beat 4 has a gold dot; once graded, its grade shows over it.
const LABEL = { perfect: "Perfect!", good: "Good", miss: "Miss" };
function drawLane(b) {
  const c = $("lane"), r = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.round(w * r)) { c.width = Math.round(w * r); c.height = Math.round(h * r); }
  const g = c.getContext("2d"); g.setTransform(r, 0, 0, r, 0, 0); g.clearRect(0, 0, w, h);
  const lineX = w * 0.4, perBeat = w * 0.1, x = (beat) => lineX + (beat - b) * perBeat;
  const font = getComputedStyle(document.body).fontFamily;
  targets.forEach((at, i) => {
    if (x(at) < -20 || x(at) > w + 20) return;
    g.globalAlpha = 0.16; g.fillStyle = "#ffb020"; g.fillRect(x(at - 3), 6, perBeat * 4, h - 12); g.globalAlpha = 1;
    g.beginPath(); g.arc(x(at), h / 2, 8, 0, Math.PI * 2); g.fillStyle = "#ffb020"; g.fill();
    if (results[i]) { g.fillStyle = "#e7ebf5"; g.font = "700 13px " + font; g.textAlign = "center"; g.fillText(LABEL[results[i].grade], x(at), 18); }
  });
  g.strokeStyle = "#3a4361"; g.lineWidth = 1;
  for (let k = Math.floor(b - 5); k < b + 7; k++) { if (k < 0) continue; const xx = x(k); g.beginPath(); g.moveTo(xx, k % 4 === 0 ? 4 : h - 16); g.lineTo(xx, h - 4); g.stroke(); }
  // "Late!" where a late tap landed, scrolling away with it
  g.fillStyle = "#ff6b8a"; g.font = "800 12px " + font; g.textAlign = "center";
  for (const at of lates) if (x(at) > -30) g.fillText("Late!", x(at), h - 10);
  g.strokeStyle = "#e7ebf5"; g.lineWidth = 2; g.beginPath(); g.moveTo(lineX, 2); g.lineTo(lineX, h - 2); g.stroke();
}

// The running count: perfect, good and miss so far.
function tally() {
  const n = (k) => results.filter((x) => x && x.grade === k).length;
  return `${n("perfect")} perfect · ${n("good")} good · ${n("miss")} miss`;
}

function reset() {
  taps = []; results = []; lates = [];
  $("result").textContent = ""; drawLane(-4);
  $("call").className = "call"; $("call").textContent = "Press Start!";
}

function stop() {
  token++; cancelAnimationFrame(raf);
  if (audio) { try { audio.ctx.close(); } catch {} }
  audio = null; $("pad").classList.remove("down");
  $("play").textContent = "Start"; $("cal").textContent = "Calibrate"; $("pad").textContent = "Tap"; cal = null;
  lamps(-1, 0);
}

const now = () => (audio.ctx.currentTime - audio.heardLate() - t0) / spb;   // beats since the song's first beat, as heard
const tapAt = () => now() + offset / 1000 / spb;                             // a tap, moved by the tap timing

async function begin() {
  stop(); reset();
  const my = ++token;
  $("play").textContent = "Stop";
  let a;
  try { a = await createAudio(day); } catch { if (my === token) { stop(); $("status").textContent = "Today's drums didn't load. Reload the page to try again."; } return; }
  if (my !== token) { try { a.ctx.close(); } catch {} return; }
  audio = a; try { await a.ctx.resume(); } catch {}
  spb = 60 / TRACK.bpm;
  const lead = a.ctx.currentTime + 0.2;
  t0 = lead + 4 * spb;                                                        // one measure of count-in
  for (let i = 0; i < 4; i++) a.sample("hat", lead + i * spb, i === 3 ? 0.9 : 0.5);
  a.track(t0, t0 + END * spb);                                                // the track, from its beat 1, LOOPS times
  for (let b = 0; b < END; b++) if (b % 4 !== 3) a.sample(TAP[day.style], t0 + b * spb + KICK_LATE, 0.9);   // the kit's kick on 1, 2, 3; beat 4 is yours
  const reach = WINDOW / 1000 / spb;                                          // a late tap still counts this many beats after
  const frame = () => {
    if (!audio || my !== token) return;
    const b = now();
    drawLane(b); lamps(b, END);
    $("call").className = b < 0 ? "call" : "call you"; $("call").textContent = b < 0 ? "Get ready" : "Tap beat 4!";
    // grade each beat 4 once a late tap could no longer reach it: the nearest tap within the window, else a miss
    targets.forEach((at, i) => {
      if (results[i] || b < at + reach) return;
      let best = null;
      for (const t of taps) { const err = (t - at) * spb * 1000; if (Math.abs(err) <= WINDOW && (best === null || Math.abs(err) < Math.abs(best))) best = err; }
      results[i] = { err: best === null ? null : Math.round(best), grade: grade(best) };
      $("result").textContent = tally();
    });
    if (results.length === targets.length && results.every(Boolean)) { finish(); return; }
    raf = requestAnimationFrame(frame);
  };
  frame();
}

function finish() {
  const p = results.filter((x) => x.grade === "perfect").length;
  $("call").className = "call"; $("call").textContent = p === targets.length ? "All perfect!" : "Done!";
  $("result").textContent = tally();
  const a = audio; setTimeout(() => { if (audio === a) stop(); }, 1500);
}

function press() {
  if (!audio) return;
  $("pad").classList.add("down");
  audio.sample(TAP[day.style], audio.ctx.currentTime, 0.9);
  if (cal) {   // calibrating: time the tap, unmoved by the current offset, against the nearest beat
    const b = now();
    if (b > -0.5) cal.push(Math.round((b - Math.round(b)) * spb * 1000));
    return;
  }
  const t = tapAt(); taps.push(t);
  // later than perfect against the nearest beat: a little "Late!" (early shows nothing)
  if (t >= 0 && (t - Math.round(t)) * spb * 1000 > PERFECT) lates.push(t);
}
const release = () => $("pad").classList.remove("down");

// The day's song: Beat Fighter's (the Worker asks it, /api/today: { day, hash }), made into music by beat.js.
async function load() {
  try {
    const r = await fetch("/api/today");
    if (!r.ok) throw new Error();
    const { day: date, hash } = await r.json();
    day = { ...beat(hash), day: date, hash, track: TRACK };
  } catch {
    $("status").textContent = "Today's song didn't load. Reload the page to try again.";
    return;
  }
  $("date").textContent = day.day;
  $("bpm").textContent = Math.round(TRACK.bpm);
  $("style").textContent = TRACK.style;
  reset();
  $("play").disabled = false; $("cal").disabled = false;
}

$("play").addEventListener("click", () => { if (audio) { stop(); reset(); } else begin(); });
$("cal").addEventListener("click", () => { if (audio) { stop(); reset(); } else calibrate(); });
const pad = $("pad");
pad.addEventListener("pointerdown", (e) => { e.preventDefault(); try { pad.setPointerCapture(e.pointerId); } catch {} press(); });
pad.addEventListener("pointerup", release); pad.addEventListener("pointercancel", release);
document.addEventListener("keydown", (e) => { if (e.code !== "Space" || e.repeat) return; if (e.target.closest?.("button:not(#pad), input")) return; e.preventDefault(); press(); });
document.addEventListener("keyup", (e) => { if (e.code === "Space") { e.preventDefault(); release(); } });

load().finally(() => { document.getElementById("ddfoot").hidden = false; });   // the footer shows only once today's song is ready, so it is never alone mid-screen
