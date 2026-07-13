# Math Helper

A simple web app that helps a teenager work through math homework **one problem
at a time**. The student enters their age, uploads a photo of problems from a
textbook or worksheet, picks a problem, and gets **Socratic tutoring** — hints
and guidance, but never the final answer. They can submit an answer to be
checked and return to the problem list at any time.

This is the first working version: a clean, correct, end-to-end flow. Visual
polish comes later; the styling foundations (design tokens) are already in
place.

## Stack

- **Next.js** (App Router) + **React** + **TypeScript**
- **Google Gemini** (`gemini-2.5-flash`) via the official
  [`@google/genai`](https://www.npmjs.com/package/@google/genai) SDK
- **KaTeX** for math rendering
- **Tailwind CSS v4** with a token-driven theme
- Persistence via **browser `localStorage`** only — no database, no accounts,
  no server-side storage (per-device)

## How it works

A single client-side state machine (age → upload → problem list → tutor) plus
two server API routes that hold the API key:

- `POST /api/extract` — receives an image, returns a structured JSON list of
  problems (uses Gemini JSON response mode).
- `POST /api/tutor` — receives the current problem, the student's age, the chat
  history, a mode (`hint` or `check`), and (in check mode) a submitted answer;
  returns the tutor's reply text.

Because Gemini is stateless, `/api/tutor` re-sends the problem and conversation
on each call. **Both system prompts live server-side** so they are never
exposed to the browser.

## Required environment variable

| Variable         | Where           | Purpose                                           |
| ---------------- | --------------- | ------------------------------------------------- |
| `GEMINI_API_KEY` | **Server only** | Google Gemini API key used by the two API routes. |

The key is read server-side only and is **never** exposed to the browser or
committed to the repo. All `.env*` files are gitignored.

Get a key from [Google AI Studio](https://aistudio.google.com/apikey).

## Local development

```bash
# 1. Install dependencies
npm install

# 2. Provide your key
cp .env.example .env.local
#   then edit .env.local and set GEMINI_API_KEY=...

# 3. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel (Hobby tier is fine).
2. In **Project → Settings → Environment Variables**, add:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** your Gemini API key
   - **Environments:** Production (and Preview/Development if you want previews
     to work)
3. Deploy. The framework preset is pinned to Next.js via `vercel.json`
   (`"framework": "nextjs"`), so Vercel uses the Next.js build output (`.next`)
   regardless of the project's auto-detected preset — no manual settings needed.

The API routes run as serverless functions and are kept comfortably under the
Hobby timeout (tutor replies are capped short and extraction runs at low
temperature).

## Re-skinning later

All design tokens live in a single place: the `:root` variables and `@theme`
block in [`app/globals.css`](app/globals.css). Colors, typography, spacing, and
radius are defined there and consumed by components only through semantic
Tailwind utilities (`bg-surface`, `text-muted`, `rounded-md`, …). To re-theme,
edit the token values — you should not need to touch component code. Dark mode
is structured for but intentionally not enabled yet (see the commented `.dark`
block).

## Privacy

Everything the student enters (age, transcribed problems, chat history) is
stored in their browser's `localStorage` on that device only. Use
**Reset everything** in the app to clear it. Uploaded photos are sent to the
server route solely to be transcribed by Gemini and are not persisted.
