# Sprawl

A little town-planning game. Streets grow on their own, homes pop up beside them, and you place shops, bus stops, parks and schools to keep everyone happy. Five fed-up homes and the run ends.

Runs on Cloudflare Pages, with a D1 database for the leaderboard.

## Layout

```
public/index.html          the whole game (one file, no build step)
functions/api/scores.js    leaderboard API (Pages Function)
migrations/                D1 schema
wrangler.toml              Pages + D1 config
```

## Run locally

```sh
npm install
npm run dev        # applies migrations to a local D1, serves on http://localhost:8788
```

## Deploy (one-time setup)

1. Create the database and copy the `database_id` it prints into `wrangler.toml`:
   ```sh
   npx wrangler login
   npx wrangler d1 create sprawl
   ```
2. Create the table in the real database:
   ```sh
   npm run db:migrate
   ```
3. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**, pick this repo.
   - Build command: *(leave empty)*
   - Build output directory: `public`
4. In the Pages project, **Settings → Bindings → Add → D1 database**: variable name `DB`, database `sprawl`.
5. Optional: **Settings → Variables and secrets**, add `IP_SALT` with any random string. It salts the hashed IPs used for rate limiting.

After that, every push to `main` deploys.

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
