# Orbi Setup Instructions

## Quick Start Guide

### 1. Prerequisites
- Node.js 18+ installed
- Deepgram API key (get from https://console.deepgram.com)

### 2. Installation

```bash
# Install dependencies
npm install
```

### 3. Configuration

Create or edit the `.env` file in the root directory:

```bash
# Required: Your Deepgram API key
DEEPGRAM_API_KEY=your_actual_api_key_here

# Optional: Customize these settings
AGENT_MODEL=gpt-4o-mini
STT_MODEL=nova-3
TTS_MODEL=aura-2-thalia-en
AGENT_GREETING=Hello! How can I help you today?
SAMPLE_RATE=24000
ENCODING=linear16
PORT=3000
NODE_ENV=development
```

### 4. Run the Application

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

### 5. Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

### 6. First Use

1. **Allow microphone access** when prompted by your browser
2. **Click the central Orbi orb** to start the voice agent
3. **Speak** and Orbi will respond!

## Troubleshooting

### Microphone not working
- Ensure you've granted microphone permissions in your browser
- Check that your microphone is working properly
- Try refreshing the page

### Connection errors
- Verify your Deepgram API key is correct in `.env`
- Check that port 3000 is available
- Ensure you have an active internet connection

### Build errors
```bash
# Clear cache and reinstall
rm -rf .next node_modules package-lock.json
npm install
npm run build
```

## Next Steps

- Read the full documentation in `ORBI_README.md`
- Customize colors and animations in `tailwind.config.ts`
- Modify the AI agent prompt in `server.ts`
- Explore the component library in `/components`

Enjoy using Orbi! 🎙️✨
