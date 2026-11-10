# Replay Lab

A doubles review for the grind from GC3 to SSL. A small Windows helper reads `.replay` files out of the Rocket League demos folder, parses them on your machine, and uploads the file plus the stats. The site then shows why games were lost, what the goals had in common, and what to train next.

## Storage

Replay files are binary and you will download them more than once, so egress matters more than the sticker price.

| Service | Free storage | Egress | Fit |
| --- | --- | --- | --- |
| Cloudflare R2 | 10 GB, 1M writes, 10M reads / month | Free | Best fit. A replay is a few MB, so this holds a few thousand games. S3-compatible, works from Vercel and from the helper. |
| Backblaze B2 | 10 GB | Free up to 3× what you store, then $0.01/GB | Fine if downloads stay close to the archive size. |
| Vercel Blob | 1 GB on Hobby, then the store locks until the month resets | 10 GB included, then metered | Too small for a replay archive, and a busy month turns the bucket off. |
| Supabase Storage | 1 GB, 50 MB per file | About 5 GB | Comfortable for avatars, tight for replays. |
| AWS S3 | 12-month intro tier | $0.09/GB after that | Easy to outgrow on a free project. |

Stats and accounts stay in Postgres (Neon’s free project: 1 GB, scale to zero). The database never holds the replay bytes.

## Run it locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without `DATABASE_URL`, accounts and stats use a Postgres database in `data/pglite`. Without the R2 variables, replay files are written to `data/replays`.

Sign-in is Steam OpenID and works without an API key. A [Steam Web API key](https://steamcommunity.com/dev/apikey) fills in your persona and avatar; without it the account name is the last four digits of the Steam id. Set `APP_URL` to the exact origin you sign in from, and set `AUTH_SECRET` to a long random string before you deploy.

## Helper

Sign in, open Settings, create a token, then:

```bash
npm run helper -- setup --token rpl_... --url http://localhost:3000
npm run helper -- scan
npm run helper -- watch
```

`scan` uploads what is already in `Documents\My Games\Rocket League\TAGame\Demos`. `watch` keeps going and picks up the next match when it ends. Parsing happens on your PC. Vercel only receives the stats JSON, and the `.replay` goes straight to R2.

`scan --force` re-reads games the helper already uploaded. Use it once after an update that adds new events. The replay file is not uploaded again.

## Scenarios

A scenario is a chain: who, which event, and optional numbers (boost under 20, you in your own third, a teammate in the opponents' third, within 1.5 seconds, the next touch). Every time the chain happens, the page also splits the follow-up: who touches the ball next, whether they score inside the window, and which team scores next in the game. Older uploads need `scan --force` before they show up there.

## Deploy on Vercel

Set `APP_URL` to the production origin, plus `AUTH_SECRET`, `STEAM_API_KEY`, `DATABASE_URL`, and the four `R2_` variables. Create the R2 bucket and an API token with object read and write.

## What the review is looking at

Header stats are always there: score, shots, saves, assists, and the goal clock. When frame parsing succeeds, each goal is tagged from the cars and the ball about a third of a second before it went in:

- kickoff
- double commit
- last man past the ball
- open net
- overcommit in their half
- counterattack
- low boost
- demo
- end-to-end

The review ranks those by how often they show up in losses, and compares your wins with your losses. The drills are written for 2s at this rank: second man stays goal-side, last man does not challenge a ball they are not favourite for, and small pads come home with you.
