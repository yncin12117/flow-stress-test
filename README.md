# Flow Stress Test

AI tools turn a spec into screens but leave the states, edge cases and stuck moments to the designer. Flow Stress Test takes a short description of a product flow and uses Claude to find where it could break: edge cases, failures, waiting states, stuck points and assumptions worth challenging. Each scenario is pinned to a step of the flow so the designer can triage it.

Built for Project 3 of CMU's *The AI Augmented Designer* (Fall 2026).

## How it works

- `public/app.html` is the interface (served at `/`).
- `app/api/stress/route.js` sends the flow to Claude (`claude-sonnet-5-5`) and returns structured JSON.
- The API key lives only in the server environment, never in the browser or the repo.

## Run locally

```bash
npm install
cp .env.example .env.local   # then paste your key into .env.local
npm run dev                  # open http://localhost:3000
```

## Deploy

Import the repo in Vercel and add the environment variable `ANTHROPIC_API_KEY`.
