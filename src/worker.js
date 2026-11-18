// rhythm-game's Worker: serves the page (public/), and GET /api/today, which asks Beat Fighter for today's song so both
// games play the same one: { day, hash }. The page makes the music from the hash with its own copy of beat.js.
// Read only: nothing about the player is sent, and nothing is stored here.
const BEAT_FIGHTER = "https://BEAT-FIGHTER-ADDRESS";   // Beat Fighter's live address (kura to confirm)

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== "/api/today") return env.ASSETS.fetch(req);
    if (req.method !== "GET") return Response.json({ error: "Not found." }, { status: 404 });
    try {
      const r = await fetch(BEAT_FIGHTER + "/api/today", { headers: { accept: "application/json" } });
      if (!r.ok) throw new Error(String(r.status));
      const { day, hash } = await r.json();
      if (typeof day !== "string" || !/^[0-9a-f]{64}$/.test(hash)) throw new Error("bad answer");
      return Response.json({ day, hash }, { headers: { "cache-control": "max-age=60" } });
    } catch {
      return Response.json({ error: "Today's song didn't load. Try again in a moment." }, { status: 502 });
    }
  },
};
