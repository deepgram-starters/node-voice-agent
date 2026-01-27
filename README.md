# Node Voice Agent Starter

Voice Agent Demo using Deepgram's API with Node.js backend and web frontend.

## Prerequisites

- [Deepgram API Key](https://console.deepgram.com/signup?jump=keys) (sign up for free)
- Node.js 24.0.0+
- pnpm 10.0.0+

**Note:** This project uses strict supply chain security measures. npm and yarn will NOT work. See [SECURITY.md](SECURITY.md) for details.

## Quickstart

1. **Initialize the project**

This project uses a git submodule for the frontend ([voice-agent-html](https://github.com/deepgram-starters/voice-agent-html)).

```bash
# Using Makefile (recommended - framework agnostic)
make init

# Or using pnpm scripts
git submodule update --init --recursive
pnpm run install:all
```

The `make init` command will:
- Clone the frontend submodule
- Install backend dependencies
- Install frontend dependencies

2. **Set your API key**

Create a `.env` file:

```bash
cp sample.env .env
# Edit .env and add your DEEPGRAM_API_KEY
```

3. **Run the app**

**Development mode** (with hot reload):

```bash
# Using Makefile
make dev

# Or using pnpm
pnpm dev
```

**Production mode** (build and serve):

```bash
# Using Makefile
make build
make start

# Or using pnpm
pnpm build
pnpm start
```

### 🌐 Open the App

[http://localhost:8080](http://localhost:8080)

## How It Works

- Establishes a WebSocket connection to `/agent/converse` endpoint
- Proxies bidirectional communication between your browser and Deepgram's Agent API
- Captures microphone audio and streams it to the voice agent
- Receives and plays back the agent's audio responses
- Displays real-time conversation transcripts showing both user and agent messages

## Architecture

This starter uses a **unified port pattern** where everything is accessible through port 8080:

### Development Mode (`pnpm dev`)
- Backend (Express) runs on port **8080**
- Frontend (Vite) runs on port **5173**
- Backend proxies all requests to Vite for hot module replacement
- Vite proxies API routes (`/agent`, `/metadata`) back to backend
- **Access the app at: http://localhost:8080**

### Production Mode (`pnpm build && pnpm start`)
- Backend serves pre-built static files from `frontend/dist`
- Backend handles all API routes directly
- **Access the app at: http://localhost:8080**

This pattern allows the frontend to be developed independently while maintaining a simple, single-port interface for developers.

### Frontend Submodule

The frontend is maintained as a separate repository ([voice-agent-html](https://github.com/deepgram-starters/voice-agent-html)) and included as a git submodule at `frontend/`. This allows:

- Frontend to be used with any backend implementation
- Independent versioning and development
- Sharing across multiple starter projects

## Makefile Commands

This project includes a Makefile for framework-agnostic operations:

```bash
make help              # Show all available commands
make init              # Initialize submodules and install dependencies
make dev               # Start development servers
make build             # Build frontend for production
make start             # Start production server
make update            # Update submodules to latest
make clean             # Remove node_modules and build artifacts
make status            # Show git and submodule status
```

Use `make` commands for a consistent experience regardless of package manager.

## Getting Help

- [Open an issue in this repository](https://github.com/deepgram-starters/node-voice-agent/issues/new)
- [Join the Deepgram Github Discussions Community](https://github.com/orgs/deepgram/discussions)
- [Join the Deepgram Discord Community](https://discord.gg/xWRaCDBtW4)

## Contributing

See our [Contributing Guidelines](./CONTRIBUTING.md) to learn about contributing to this project.

## Code of Conduct

This project follows the [Deepgram Code of Conduct](./CODE_OF_CONDUCT.md).

## Security

For security policy and procedures, see our [Security Policy](./SECURITY.md).

## License

MIT - See [LICENSE](./LICENSE)
