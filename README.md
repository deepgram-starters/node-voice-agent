# Node Voice Agent Starter

Voice Agent Demo using Deepgram's API with Node.js backend and web frontend.

## Prerequisites

- [Deepgram API Key](https://console.deepgram.com/signup?jump=keys) (sign up for free)
- Node.js 24.0.0+
- pnpm 10.0.0+

**Note:** This project uses strict supply chain security measures. npm and yarn will NOT work. See [SECURITY.md](SECURITY.md) for details.

## Quickstart

1. **Install dependencies**

```bash
# Option 1: Use the helper script (recommended)
pnpm run install:all

# Option 2: Manual two-step install
pnpm install
cd frontend && pnpm install && cd ..
```

**Note:** Due to security settings (`ignore-scripts=true`), frontend dependencies must be installed separately. The `install:all` script handles both steps. See [SECURITY.md](SECURITY.md) for details.

3. **Set your API key**

Create a `.env` file:

```bash
DEEPGRAM_API_KEY=your_api_key_here
```

4. **Run the app**

**Development mode** (with hot reload):

```bash
pnpm dev
```

**Production mode** (build and serve):

```bash
pnpm build
pnpm start
```

### 🌐 Open the App

[http://localhost:3000](http://localhost:3000)

## How It Works

- Establishes a WebSocket connection to `/agent/converse` endpoint
- Proxies bidirectional communication between your browser and Deepgram's Agent API
- Captures microphone audio and streams it to the voice agent
- Receives and plays back the agent's audio responses
- Displays real-time conversation transcripts showing both user and agent messages

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
