# node-voice-agent

Node.js demo app for Deepgram Voice Agent.

## Architecture

- **Backend:** Node.js (JavaScript) on port 8081
- **Frontend:** Vite + vanilla JS on port 8080 (git submodule: `voice-agent-html`)
- **API type:** WebSocket — `WS /api/voice-agent`
- **Deepgram API:** Agent API (`wss://agent.deepgram.com/v1/agent/converse`)
- **Auth:** JWT session tokens via `/api/session` (WebSocket auth uses `access_token.<jwt>` subprotocol)

## Key Files

| File | Purpose |
|------|---------|
| `server.js` | Main backend — API endpoints and WebSocket proxy |
| `deepgram.toml` | Metadata, lifecycle commands, tags |
| `Makefile` | Standardized build/run targets |
| `sample.env` | Environment variable template |
| `frontend/main.js` | Frontend logic — UI controls, WebSocket connection, audio streaming |
| `frontend/index.html` | HTML structure and UI layout |
| `deploy/Dockerfile` | Production container (Caddy + backend) |
| `deploy/Caddyfile` | Reverse proxy, rate limiting, static serving |

## Quick Start

```bash
# Initialize (clone submodules + install deps)
make init

# Set up environment
test -f .env || cp sample.env .env  # then set DEEPGRAM_API_KEY

# Start both servers
make start
# Backend: http://localhost:8081
# Frontend: http://localhost:8080
```

## Start / Stop

**Start (recommended):**
```bash
make start
```

**Start separately:**
```bash
# Terminal 1 — Backend
node server.js

# Terminal 2 — Frontend
cd frontend && corepack pnpm run dev -- --port 8080 --no-open
```

**Stop all:**
```bash
lsof -ti:8080,8081 | xargs kill -9 2>/dev/null
```

**Clean rebuild:**
```bash
rm -rf node_modules frontend/node_modules frontend/.vite
make init
```

## Dependencies

- **Backend:** `package.json` — Uses `corepack pnpm` — Node's built-in package manager version pinning.
- **Frontend:** `frontend/package.json` — Vite dev server
- **Submodules:** `frontend/` (voice-agent-html), `contracts/` (starter-contracts)

Install: `corepack pnpm install`
Frontend: `cd frontend && corepack pnpm install`

## API Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/session` | GET | None | Issue JWT session token |
| `/api/metadata` | GET | None | Return app metadata (useCase, framework, language) |
| `/api/voice-agent` | WS | JWT | Full-duplex voice conversation with an AI agent. |

## Customization Guide

### How the Agent Works
The backend is a **pure WebSocket proxy** — it forwards messages between the browser and Deepgram's Agent API. All agent configuration happens via JSON messages from the frontend.

### Agent Settings (sent from frontend)
The frontend sends a `Settings` message after connecting:

```json
{
  "type": "Settings",
  "audio": {
    "input": { "encoding": "linear16", "sample_rate": 16000 },
    "output": { "encoding": "linear16", "sample_rate": 16000 }
  },
  "agent": {
    "listen": { "provider": { "type": "deepgram", "model": "nova-3" } },
    "speak": { "provider": { "type": "deepgram", "model": "aura-2-thalia-en" } },
    "think": {
      "provider": { "type": "open_ai", "model": "gpt-4o-mini" },
      "prompt": "You are a helpful assistant."
    }
  }
}
```

### Customizable Components

| Component | Field | Options | Effect |
|-----------|-------|---------|--------|
| **Listen** (STT) | `agent.listen.provider.model` | `nova-3`, `nova-2` | Speech recognition model |
| **Speak** (TTS) | `agent.speak.provider.model` | Any `aura-*` voice | Agent's voice |
| **Think** (LLM) | `agent.think.provider.type` | `open_ai`, `anthropic` | LLM provider |
| **Think** (LLM) | `agent.think.provider.model` | `gpt-4o-mini`, `gpt-4o`, etc. | LLM model |
| **Prompt** | `agent.think.prompt` | Any system prompt | Agent personality/behavior |

### Live Updates (no reconnect needed)
The frontend can update these settings mid-conversation:
- `{ "type": "UpdateSpeak", "model": "aura-2-luna-en" }` — Change voice
- `{ "type": "UpdatePrompt", "prompt": "New instructions..." }` — Change prompt
- `{ "type": "InjectUserMessage", "content": "text" }` — Send text as user

### Adding Function Calling
The Agent API supports function calling. Add a `functions` array to the Settings message:
```json
{
  "agent": {
    "think": {
      "functions": [
        {
          "name": "get_weather",
          "description": "Get current weather",
          "parameters": { "type": "object", "properties": { "city": { "type": "string" } } }
        }
      ]
    }
  }
}
```
Then handle `FunctionCallRequest` messages in the frontend and respond with `FunctionCallResponse`.

### Frontend UI Controls
The frontend provides:
- Model dropdowns for listen/speak/think (pre-connection)
- System prompt textarea (editable pre and post connection)
- Chat input for text messages
- "Update Settings" button for live changes

To add new controls, edit `frontend/main.js` and include the values in the Settings/Update messages.

## Frontend Changes

The frontend is a git submodule from `deepgram-starters/voice-agent-html`. To modify:

1. **Edit files in `frontend/`** — this is the working copy
2. **Test locally** — changes reflect immediately via Vite HMR
3. **Commit in the submodule:** `cd frontend && git add . && git commit -m "feat: description"`
4. **Push the frontend repo:** `cd frontend && git push origin main`
5. **Update the submodule ref:** `cd .. && git add frontend && git commit -m "chore(deps): update frontend submodule"`

**IMPORTANT:** Always edit `frontend/` inside THIS starter directory. The standalone `voice-agent-html/` directory at the monorepo root is a separate checkout.

### Adding a UI Control for a New Feature
1. Add the HTML element in `frontend/index.html` (input, checkbox, dropdown, etc.)
2. Read the value in `frontend/main.js` when making the API call or opening the WebSocket
3. Pass it as a query parameter in the WebSocket URL
4. Handle it in the backend `server.js` — read the param and pass it to the Deepgram API

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DEEPGRAM_API_KEY` | Yes | — | Deepgram API key |
| `PORT` | No | `8081` | Backend server port |
| `HOST` | No | `0.0.0.0` | Backend bind address |
| `SESSION_SECRET` | No | — | JWT signing secret (production) |

## Conventional Commits

All commits must follow conventional commits format. Never include `Co-Authored-By` lines for Claude.

```
feat(node-voice-agent): add diarization support
fix(node-voice-agent): resolve WebSocket close handling
refactor(node-voice-agent): simplify session endpoint
chore(deps): update frontend submodule
```

## Testing

```bash
# Run conformance tests (requires app to be running)
make test

# Manual endpoint check
curl -sf http://localhost:8081/api/metadata | python3 -m json.tool
curl -sf http://localhost:8081/api/session | python3 -m json.tool
```
