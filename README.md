# Sprawl

A little town-planning game. Streets grow on their own, homes pop up beside them, and you place shops, bus stops, parks and schools to keep everyone happy. Five fed-up homes and the run ends.

Runs on Cloudflare Workers (static assets + a small API), with a D1 database for the leaderboard.

## Layout

```
public/index.html          the whole game (one file, no build step)
src/worker.js              routes /api/scores, serves everything else from public/
src/scores.js              leaderboard API
migrations/                D1 schema
wrangler.toml              Worker + assets + D1 config
```

## Run locally

```sh
npm install
npm run dev        # applies migrations to a local D1, serves on http://localhost:8787
```

## Deploy

The Worker deploys from GitHub via Workers Builds (deploy command `npx wrangler deploy`), so every push to `main` goes live.

One-time setup, already done for this project:

1. `npx wrangler d1 create sprawl` and put the `database_id` in `wrangler.toml`.
2. `npm run db:migrate` to create the table.
3. Cloudflare dashboard: **Workers & Pages → Create → Import a repository**, pick this repo. The Worker name must match `name` in `wrangler.toml` (`sprawl`).
4. Optional: add a secret `IP_SALT` with any random string. It salts the hashed IPs used for rate limiting.

## Leaderboard API

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/scores?board=daily&seed=YYYY-MM-DD` | | `{ top, total }` |
| GET | `/api/scores?board=random` | | `{ top, total }` |
| POST | `/api/scores` | `{ name, score, week, seed, daily, t, houses }` | `{ id, rank, total, top }` |

Daily maps use the UTC date as their seed, so everyone plays the same town each day.

### Cheat checks

Scores are worked out in the browser, so the server only checks they are plausible:

- game time `t` must match the week reached (45 game seconds a week)
- score can't exceed every home being happy at max level for the whole run
- daily scores are only accepted for yesterday, today or tomorrow (UTC)
- one submission per IP every 20 seconds (IPs are stored as salted hashes)

A determined cheater can still post a believable fake. The fix later is to send the run's moves and replay them on the server, which works because the game is deterministic from its seed.
