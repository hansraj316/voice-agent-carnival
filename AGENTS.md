# Repository Guidelines

## Project Structure & Module Organization
- `server.js`: Express server and Realtime agent wiring.
- `public/`: Browser client (`index.html`, `client.js`) and UI assets.
- `.env(.example)`: Runtime configuration (API keys, port).
- `validate.js`: Local environment and runtime checks.
- `package.json`: Scripts and dependencies.

## Build, Test, and Development Commands
- `npm start`: Launches the Express server on `http://localhost:3000`.
- `npm run dev`: Starts the server with `node --watch` for auto-reload.
- `npm run validate`: Verifies `.env`, Node.js version, and dependencies.
- `npm test`: Syntax check of `server.js` (fast sanity test).
- Setup tip: `npm run setup` installs deps and copies `.env.example`.

## Coding Style & Naming Conventions
- Indentation: 4 spaces; include semicolons; ES modules (`import`/`export`).
- Naming: `PascalCase` for classes (e.g., `VoiceEchoServer`), `camelCase` for functions/variables.
- Files: lowercase with hyphens or single words (e.g., `server.js`, `client.js`).
- No linter/formatter is configured—match existing style; keep functions small and cohesive.

## Testing Guidelines
- Quick checks: `npm test` and `npm run validate` before pushing.
- Manual flow: start server, open `http://localhost:3000`, connect, tap mic, speak, verify echo and status changes.
- Edge cases: mic permission denied, reconnect after server restart, noisy environments.
- Future tests: place browser tests under `public/` or introduce a `tests/` directory with your chosen framework; name files `*.test.js`.

## Commit & Pull Request Guidelines
- Commits: concise, imperative subject (≤72 chars) with context (e.g., "Add echo VAD fallback").
- Consider Conventional Commits (`feat:`, `fix:`, `chore:`) for clarity.
- PRs: include summary, rationale, runnable steps (`npm start`), screenshots/GIFs of the UI, and any logs.
- Link issues, note breaking changes, and call out security-sensitive edits.

## Security & Configuration Tips
- Never commit `.env`; keep `OPENAI_API_KEY` local or secret-managed.
- The `/api/session-token` path is a placeholder—do not expose raw API keys to the browser; replace with proper ephemeral token issuance before production.
- Use HTTPS in production for microphone access; restrict CORS as needed.
