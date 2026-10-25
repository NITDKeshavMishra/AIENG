# Candidate AI — React frontend

A ChatGPT-inspired interface for the supplied FastAPI candidate backend.

## Requirements
- Node.js 22.12+ recommended for Vite 7.
- The FastAPI backend supplied in the conversation, with POST /chat and SSE token/done/error events.

## Run
1. Extract this project and open a terminal in its directory.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Set `VITE_API_BASE_URL=http://localhost:8000`.
5. Run `npm run dev` and open the URL printed by Vite.
6. In a separate terminal, start the backend: `uvicorn main:app --reload`.

Set backend `FRONTEND_ORIGINS` to the actual frontend origin, e.g. `http://localhost:5173`. Restart the backend after changing it. If Vite selects another port, allow that origin too, or use `npm run dev -- --port 5173 --strictPort`.

## Features
- Responsive sidebar and ChatGPT-inspired conversation interface
- Incremental SSE response rendering and Markdown
- Local conversation persistence (one conversation, not multiple saved chats)
- Explicit job-description context and fit-analysis action
- Dark/light appearance, typing indicator, stop generation, copy response
- Enter to send; Shift+Enter for newline; IME composition support
- Incomplete or aborted assistant answers excluded from future history
- The latest 20 completed messages are sent as context, each capped at 8,000 characters, matching backend limits. Older context is not sent.

## API contract
POST /chat:
```json
{"question":"Tell me about the candidate","history":[],"job_description":null,"stream":true}
```
Expected SSE:
```
event: token
data: {"text":"Hello"}

event: done
data: {"finish_reason":"stop"}

```
Errors use `event: error` with `{"message":"..."}`. The parser buffers chunks until complete events arrive and incrementally decodes UTF-8. It targets the supplied backend's LF-delimited events.

## Build and deployment
Run `npm run build`. Output directory: `dist`.
For Vercel, import the frontend repository, use the Vite preset, and set `VITE_API_BASE_URL` to the deployed HTTPS backend URL before building. Add the Vercel frontend origin to backend `FRONTEND_ORIGINS` and restart/redeploy it.
Never put the Groq key in frontend variables; VITE_ variables are public.

## Privacy and limitations
Messages and the job description persist in this browser's localStorage. Clear conversation removes chat messages; remove job context separately using the job-description dialog. Browser storage is not encrypted. Submitted history and job context go to the backend and Groq. Avoid confidential information.

The interface is not affiliated with ChatGPT or OpenAI. Candidate name and initials are display labels, not additional evidence supplied to the model. Google Fonts is optional; system fallback fonts work without it. Stop cancels the browser request, but cancellation propagation to upstream inference may not be instantaneous. The modal supports Escape and autofocus but is not a full production focus-trapped dialog. The app has no authentication, uploads, voice features, or server-side chat database. Add access controls and rate limits before public use. This project has not been browser-tested in this execution environment.
