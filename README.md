# NEON GENESIS ARCHIVE

Web planner for managing daily memos, tasks, and archive notes with an LLM-assisted classification flow.

---

## Core Features

- Capture memos in natural language and process them into planner-friendly items.
- Classify input into TODO vs Archive with an LLM-based pipeline.
- Manage memo ordering and grouping with drag-and-drop interactions.
- Store data locally for fast, offline-first usage.
- Sync planner data to Supabase when authenticated.
- Run as a browser app.

## System Overview

- UI: Next.js App Router + React client components.
- Domain logic: memo classification and parsing flow in `src/lib/memo`.
- Storage layer: local persistence plus server sync helpers in `src/lib/storage.ts`.
- Auth and backend connectivity: Supabase client and auth session handling in `src/lib/supabase.ts`.
- Testing: Vitest + Testing Library for behavior and sync-path validation.

## Tech Stack

- `Next.js 16` + `React 19` + `TypeScript`
- `Supabase` for auth and data sync
- `Google Gemini API` for memo classification
- `dnd-kit` for drag-and-drop interactions
- `Vitest` + Testing Library for tests

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

## Required Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GOOGLE_GMAIL_CLIENT_ID=your_google_oauth_client_id
GOOGLE_GMAIL_CLIENT_SECRET=your_google_oauth_client_secret
GMAIL_COOKIE_SECRET=long_random_secret_for_cookie_encryption
# optional: defaults to {app_origin}/api/gmail/callback
GOOGLE_GMAIL_REDIRECT_URI=http://localhost:3000/api/gmail/callback
```

Supabase can also be configured at runtime from the app UI.
For Gmail integration, enable the Gmail API in Google Cloud and add the callback URL to your OAuth client's authorized redirect URIs.

## Scripts

```bash
npm run dev      # run dev server
npm run build    # production build
npm run start    # production server
npm run test     # run tests
npm run lint     # run lint
```

## Development Note

This project was developed mostly through AI-assisted vibe coding iterations.
This README was also created and refined through AI vibe coding.
