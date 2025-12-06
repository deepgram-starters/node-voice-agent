# Orbi - Voice-First AI Assistant UI

A beautiful, glassmorphic voice-first AI assistant interface powered by Deepgram Voice Agent API. Features ambient calm-tech visuals, dual-mode interaction (compact widget ↔ full dashboard), and a reactive luminous orb centerpiece.

![Orbi UI](https://via.placeholder.com/1200x600/E8D5F0/1A1A2E?text=Orbi+Voice+Assistant)

## ✨ Features

### 🎨 Design System
- **Glassmorphic Aesthetics** - Translucent panels with backdrop blur
- **Ambient Background** - Flowing gradient animations with wave effects
- **Orbi Color Palette** - Soft lavenders, warm pinks, aqua-cyan tones
- **Voice-Reactive Orb** - Animated central orb with starfield and glow effects
- **Accessibility Compliant** - WCAG 2.2 compliant with high contrast ratios

### 🎙️ Voice Interaction
- **Real-time Voice Processing** - WebSocket-based streaming audio
- **Multiple States** - Idle, Listening, Processing, Speaking, Error
- **Visual Feedback** - Pulsing rings, glow effects, waveform animations
- **Wake Word Support** - Configurable wake word detection (via Deepgram)

### 🖥️ UI Components
- **VoiceOrb** - Animated central orb with canvas-based starfield
- **GlassPanel** - Draggable, collapsible translucent panels
- **VoiceWidget** - Minimizable floating voice control
- **Dashboard Layout** - Quad-panel layout with central orb
- **Chat History** - Real-time conversation display
- **Tools & Services** - Quick action icon grid
- **Documents & Files** - File type icons with color coding
- **Voice Settings** - Toggle controls for voice features

### 🔄 Modes
1. **Dashboard Mode** - Full-screen quad-panel layout
2. **Widget Mode** - Compact floating voice assistant

## 📋 Prerequisites

- Node.js 18+ and npm
- Deepgram API key ([Get one here](https://console.deepgram.com/signup))
- Modern browser with WebSocket and Web Audio API support

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd node-voice-agent
npm install
```

### 2. Configure Environment

Copy the example environment file and add your Deepgram API key:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
DEEPGRAM_API_KEY=your_actual_api_key_here
AGENT_MODEL=gpt-4o-mini
STT_MODEL=nova-3
TTS_MODEL=aura-2-thalia-en
AGENT_GREETING=Hello! How can I help you today?
SAMPLE_RATE=24000
ENCODING=linear16
PORT=3000
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Production Build

```bash
npm run build
npm start
```

## 🎨 Design Tokens

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--orb-core` | `#00D4E8` | Orb center, active states |
| `--orb-deep` | `#0A1628` | Orb interior |
| `--orb-halo` | `#7EE8FA` | Outer glow rings |
| `--surface-lavender` | `#E8D5F0` | Background gradient |
| `--surface-rose` | `#F5D0E0` | Background gradient |
| `--surface-cream` | `#FFF8F0` | Background gradient |
| `--text-primary` | `#1A1A2E` | Headlines, labels |
| `--text-secondary` | `#6B6B8D` | Body text |
| `--voice-active` | `#00E5CC` | Mic active indicator |

### Typography

- **Display Font**: Outfit (headings, branding)
- **Body Font**: Inter (UI text, content)

### Glassmorphism Specs

- **Backdrop Blur**: 20px (panels), 12px (light elements)
- **Background Opacity**: 65-85%
- **Border**: 1px solid rgba(255,255,255,0.4)
- **Border Radius**: 24px (panels), 16px (cards), 12px (buttons)

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DEEPGRAM_API_KEY` | - | **Required**. Your Deepgram API key |
| `AGENT_MODEL` | `gpt-4o-mini` | LLM model for conversation |
| `STT_MODEL` | `nova-3` | Speech-to-text model |
| `TTS_MODEL` | `aura-2-thalia-en` | Text-to-speech voice |
| `AGENT_GREETING` | `Hello! How can I help you today?` | Initial greeting |
| `SAMPLE_RATE` | `24000` | Audio sample rate (Hz) |
| `ENCODING` | `linear16` | Audio encoding format |
| `PORT` | `3000` | Server port |

### Customizing the Voice Agent

Edit the agent prompt in `server.ts`:

```typescript
think: {
  provider: {
    type: 'open_ai',
    model: process.env.AGENT_MODEL || 'gpt-4o-mini'
  },
  prompt: `Your custom prompt here...`
}
```

### Supported Models

**LLM Models (agent.think.provider)**
- `gpt-4o`
- `gpt-4o-mini`
- `gpt-4-turbo`
- Claude models (via Deepgram)

**STT Models (agent.listen.provider)**
- `nova-3` (recommended)
- `nova-2`
- `base`

**TTS Models (agent.speak.provider)**
- `aura-2-thalia-en` (female, calm)
- `aura-2-stella-en` (female, upbeat)
- `aura-2-asteria-en` (female, conversational)
- `aura-2-orpheus-en` (male, calm)

## 📁 Project Structure

```
orbi-ui/
├── app/
│   ├── layout.tsx          # Root layout with fonts
│   └── page.tsx            # Main entry point
├── components/
│   ├── core/
│   │   ├── VoiceOrb.tsx    # Animated orb component
│   │   ├── GlassPanel.tsx  # Glassmorphic panel
│   │   ├── VoiceWidget.tsx # Compact widget
│   │   └── IconButton.tsx  # Icon buttons
│   ├── panels/
│   │   ├── ChatHistory.tsx
│   │   ├── ToolsServices.tsx
│   │   ├── DocumentsFiles.tsx
│   │   └── VoiceSettings.tsx
│   └── layout/
│       ├── Dashboard.tsx   # Main dashboard
│       └── AmbientBackground.tsx
├── hooks/
│   └── useVoiceAgent.ts    # Voice agent hook
├── lib/
│   └── types.ts            # TypeScript types
├── styles/
│   ├── tokens.css          # Design tokens
│   └── globals.css         # Global styles
├── server.ts               # Custom Next.js + WebSocket server
├── tailwind.config.ts      # Tailwind configuration
└── .env                    # Environment variables
```

## 🎯 Usage

### Starting a Conversation

1. **Dashboard Mode**: Click the central Orbi orb
2. **Widget Mode**: Click the floating voice widget

### Voice States

- **Idle** - Gentle breathing animation
- **Listening** - Pulsing cyan rings
- **Processing** - Rotating starfield
- **Speaking** - Audio-reactive waveform
- **Error** - Red-tinted pulse

### Switching Modes

- Click **"Minimize"** to switch to Widget Mode
- Click the **Widget** to expand to Dashboard Mode

## 🔌 API Integration

The application uses Deepgram Voice Agent API for:

- **Speech-to-Text** (STT) - Real-time transcription
- **LLM Processing** - Conversation logic
- **Text-to-Speech** (TTS) - Voice synthesis

### WebSocket Flow

```
Browser ──audio──> WebSocket Server ──audio──> Deepgram Agent
Browser <──audio── WebSocket Server <──audio── Deepgram Agent
```

### Key Events

**Client Messages:**
- Audio stream (PCM Int16)

**Server Events:**
- `Welcome` - Connection established
- `SettingsApplied` - Configuration confirmed
- `ConversationText` - Transcript updates
- `Audio` - TTS audio chunks
- `Error` - Error notifications

## 🎨 Customization

### Changing Colors

Edit `tailwind.config.ts`:

```typescript
colors: {
  orb: {
    core: '#00D4E8', // Change to your color
    deep: '#0A1628',
    halo: '#7EE8FA',
  },
  // ... more colors
}
```

### Modifying Animations

Edit animation timing in `tailwind.config.ts`:

```typescript
animation: {
  'orb-breathe': 'orbBreathe 4s ease-in-out infinite',
}
```

### Adjusting Panel Layout

Edit grid configuration in `Dashboard.tsx`:

```typescript
className="grid grid-cols-[320px_1fr_320px] grid-rows-[1fr_1fr] gap-6"
```

## 🐛 Troubleshooting

### Microphone Not Working

1. Check browser permissions (allow microphone access)
2. Verify HTTPS connection (required for getUserMedia)
3. Check console for WebRTC errors

### WebSocket Connection Fails

1. Verify server is running (`npm run dev`)
2. Check port 3000 is not in use
3. Verify Deepgram API key is set

### Audio Quality Issues

1. Adjust `SAMPLE_RATE` in .env (try 16000 or 48000)
2. Enable echo cancellation in `useVoiceAgent.ts`
3. Check microphone quality/distance

### Build Errors

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

## 📚 Resources

- [Deepgram Voice Agent Docs](https://developers.deepgram.com/docs/voice-agent)
- [Deepgram API Reference](https://developers.deepgram.com/reference/voice-agent/voice-agent)
- [Next.js Documentation](https://nextjs.org/docs)
- [Framer Motion](https://www.framer.com/motion/)
- [Tailwind CSS](https://tailwindcss.com/docs)

## 🤝 Contributing

Contributions are welcome! Please read the [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Design inspired by calm technology principles
- Glassmorphism influenced by Apple's Design Language
- Deepgram for Voice Agent API
- Color palette derived from ambient pastel aesthetics

---

**Built with ❤️ using Next.js, React, Tailwind CSS, and Deepgram**
