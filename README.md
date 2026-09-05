# Ekart Tracker — Cloudflare Pages

A deployable React + TypeScript Ekart tracker using Cloudflare Pages Functions.

## What it does

- Tracks any Ekart tracking ID.
- Server-side Cloudflare Pages Function fetches the public Ekart tracking page.
- Parses the tracking table.
- Shows current status, expected delivery, route and full timeline.
- Browser auto-refresh every 5 minutes.
- Optional browser notifications when the page is open.
- No Express server, no Node server, no separate backend.

## Local development

Requirements: Node.js 20+.

```bash
npm install
npm run dev
```

Open the URL Wrangler prints (normally `http://localhost:8788`).

## Cloudflare Pages deployment

### GitHub method

Push this entire project to GitHub.

In Cloudflare:
1. Workers & Pages → Create application → Pages → Import an existing Git repository.
2. Select the repository.
3. Build command: `npm run build`
4. Build output directory: `dist`
5. Deploy.

The `functions/` directory stays at the project root; do NOT put it inside `dist`.

### CLI method

Install/login to Wrangler:

```bash
npx wrangler login
```

Then:

```bash
npm run deploy
```

## Notifications

The web app can use browser notifications. The page must remain open for the 5-minute polling to run.

If you need notifications while the browser/page is closed, this requires a scheduled backend + persistent state (for example a Worker Cron + KV/D1) and a notification provider such as Telegram/email/push. This Pages-only version intentionally does not pretend to provide background monitoring when no browser is running.

## Important

This project uses Ekart's public tracking webpage. It does not bypass CAPTCHA, authentication, private APIs, or access controls. If Ekart changes its HTML or blocks Cloudflare requests, the parser will need updating.

Cloudflare Pages Functions are the server-side component used here; Cloudflare documents that Pages Functions can execute server-side code and that TypeScript is supported.
