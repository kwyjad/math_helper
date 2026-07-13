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
- **Google Gemini** (`gemini-3.1-flash-lite`, the cheapest multimodal model)
  via the official
  [`@google/genai`](https://www.npmjs.com/package/@google/genai) SDK
- **KaTeX** for math rendering
- **Tailwind CSS v4** with a token-driven theme
- Persistence via **browser `localStorage`** only — no database, no accounts,
  no server-side storage (per-device)

## How it works

A single client-side state machine (age → upload → problem list → tutor) plus
two server API routes that hold the API key:

- `POST /api/extract` — receives an image, returns a structured JSON list of
  problems (uses Gemini JSON response mode). Each problem captures its stem,
  LaTeX, multiple-choice **options**, whether it depends on a **figure**, and
  any **table** (as markdown).
- `POST /api/tutor` — receives the current problem (including its options), the
  student's age, the chat history, a mode (`hint` or `check`), a submitted
  answer (a typed value or a chosen option letter in check mode), and — when
  available — the **page image**, which is passed to the multimodal model so the
  tutor can read diagrams and tables. Returns the tutor's reply text.

Because Gemini is stateless, `/api/tutor` re-sends the problem and conversation
on each call. **Both system prompts live server-side** so they are never
exposed to the browser.

## Required environment variable

| Variable         | Where               | Purpose                                                                                                    |
| ---------------- | ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY` | **Server**          | **Required.** Google Gemini API key used by the two API routes.                                            |
| `GEMINI_MODEL`   | **Server** (opt.)   | Overrides the Gemini model. Defaults to `gemini-3.1-flash-lite`. Set this to swap models without a deploy. |

The key is read server-side only and is **never** exposed to the browser or
committed to the repo. All `.env*` files are gitignored.

> **Note on models:** Google deprecates and retires Gemini models fairly
> aggressively (e.g. the `gemini-2.5-flash` family was pulled for new users in
> mid-2026, returning `404 NOT_FOUND`). The app defaults to the cheapest
> current multimodal model, `gemini-3.1-flash-lite`. If that model is ever
> retired, you'll see a clear "AI service" error — just set `GEMINI_MODEL` in
> Vercel to the current cheapest model (check
> [Google's model list](https://ai.google.dev/gemini-api/docs/models)) and
> redeploy; no code change needed.

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
**Reset everything** in the app to clear it. The uploaded photo is downscaled
and re-compressed in the browser and kept in `localStorage` too, so the tutor
can refer back to diagrams and tables on the page — it is never stored on any
server. It is sent to the Gemini API (server-side) to be transcribed and, during
tutoring, so the model can read figures.
