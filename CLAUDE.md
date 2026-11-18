# rhythm-game: working notes

## This repo

rhythm-game: a daily rhythm game, played like Rhythm Tengoku (GBA): the day's song plays over a hidden beat, and you tap
the silent beat 4 of every measure. Each tap is graded perfect, good or miss. It plays Beat Fighter's song of the day:
this game's Worker asks Beat Fighter (`/api/today`) for the day and its hash, and the page makes the music from the hash.
Nothing is saved except your tap timing, in your browser. If the Cloudflare Worker `rhythm-game` is connected to this
repo, a push to `main` is a release.

- **One place for each rule:** the day's music in `public/beat.js`, scoring in `public/score.js`, the day's sound in
  `public/audio.js`, the page in `public/app.js`, the Worker (the page, plus `/api/today`) in `src/worker.js`.
- **Same song as Beat Fighter:** `public/beat.js` must make the same music from a hash as Beat Fighter's copy does. If
  Beat Fighter's `beat.js` changes how a hash becomes music, copy that change here too.
- **Timing is fixed:** perfect within 35 ms, good within 80 ms.
- **Sound is samples only:** no browser oscillators, ever. Every sound is a recording in `public/samples/` (sources in
  its README), one pack per kit: the drums are CC0; the house beds and house kicks 2 to 5 are Stable Audio 3 recordings
  (Stability AI Community License).
- **Testing:** `npm test` must pass before any commit, plus one quick check of whatever changed. Expected values come
  from hand-worked examples, not the code under test.
- **Releases:** every release bumps `VERSION` in `public/version.js` and adds a `CHANGELOG.md` entry (a test checks they
  match).
