import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { WebSocket, WebSocketServer } from 'ws'
import { createClient, AgentEvents } from '@deepgram/sdk'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY
const PORT = parseInt(process.env.PORT || '3000', 10)
const dev = process.env.NODE_ENV !== 'production'

if (!DEEPGRAM_API_KEY) {
  console.error('Please set your DEEPGRAM_API_KEY in the .env file')
  process.exit(1)
}

// Initialize Deepgram
const deepgram = createClient(DEEPGRAM_API_KEY)

// Initialize Next.js
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  // Create HTTP server
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  // Create WebSocket server
  const wss = new WebSocketServer({ server })

  // Function to connect to Deepgram Voice Agent
  async function connectToAgent(browserWs: WebSocket) {
    try {
      const agent = deepgram.agent()

      agent.on(AgentEvents.Open, () => {
        console.log('Agent connection established')
      })

      agent.on('Welcome', () => {
        console.log('Agent welcomed')
        agent.configure({
          audio: {
            input: {
              encoding: process.env.ENCODING || 'linear16',
              sample_rate: parseInt(process.env.SAMPLE_RATE || '24000', 10)
            },
            output: {
              encoding: process.env.ENCODING || 'linear16',
              sample_rate: parseInt(process.env.SAMPLE_RATE || '24000', 10),
              container: 'none'
            }
          },
          agent: {
            listen: {
              provider: {
                type: 'deepgram',
                model: process.env.STT_MODEL || 'nova-3'
              }
            },
            think: {
              provider: {
                type: 'open_ai',
                model: process.env.AGENT_MODEL || 'gpt-4o-mini'
              },
              prompt: `You are Orbi, a helpful voice assistant with a calm and friendly personality. Your responses should be conversational, concise (1-2 sentences max, under 120 characters), and natural. You can listen and speak, and all your responses will be spoken aloud.

Guidelines:
- Keep responses brief and to the point
- Ask one follow-up question at a time if needed
- If a question is unclear, ask for clarification
- Maintain a warm, supportive tone
- Avoid repetition and stay engaging`
            },
            speak: {
              provider: {
                type: 'deepgram',
                model: process.env.TTS_MODEL || 'aura-2-thalia-en'
              }
            },
            greeting: process.env.AGENT_GREETING || "Hello! How can I help you today?"
          }
        })
      })

      agent.on('SettingsApplied', () => {
        console.log('Settings applied')
      })

      agent.on(AgentEvents.ConversationText, (message: { role: string; content: string }) => {
        console.log(`${message.role}: ${message.content}`)
      })

      agent.on(AgentEvents.Audio, (audio: Buffer) => {
        if (browserWs?.readyState === WebSocket.OPEN) {
          try {
            browserWs.send(audio, { binary: true })
          } catch (error) {
            console.error('Error sending audio to browser:', error)
          }
        }
      })

      agent.on(AgentEvents.Error, (error: Error) => {
        console.error('Agent error:', error)
      })

      agent.on(AgentEvents.Close, () => {
        console.log('Agent connection closed')
        if (browserWs?.readyState === WebSocket.OPEN) {
          browserWs.close()
        }
      })

      return agent
    } catch (error) {
      console.error('Error connecting to Deepgram:', error)
      throw error
    }
  }

  // Handle WebSocket connections
  wss.on('connection', async (ws) => {
    console.log('Browser client connected')

    let agent: any = null

    try {
      agent = await connectToAgent(ws)

      ws.on('message', (data: Buffer) => {
        try {
          if (agent) {
            agent.send(data)
          }
        } catch (error) {
          console.error('Error sending audio to agent:', error)
        }
      })

      ws.on('close', async () => {
        if (agent) {
          await agent.disconnect()
        }
        console.log('Browser client disconnected')
      })

      ws.on('error', (error) => {
        console.error('WebSocket error:', error)
      })
    } catch (error) {
      console.error('Failed to initialize agent:', error)
      ws.close()
    }
  })

  // Start server
  server.listen(PORT, () => {
    console.log(`> Orbi ready on http://localhost:${PORT}`)
    console.log(`> Environment: ${dev ? 'development' : 'production'}`)
  })

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down server...')

    const forceExit = setTimeout(() => {
      console.error('Force closing due to timeout')
      process.exit(1)
    }, 5000)

    let pendingOps = { ws: true, http: true }

    const checkComplete = () => {
      if (!pendingOps.ws && !pendingOps.http) {
        clearTimeout(forceExit)
        console.log('Server shutdown complete')
        process.exit(0)
      }
    }

    wss.clients.forEach((client) => {
      try {
        client.close()
      } catch (err) {
        console.error('Error closing WebSocket client:', err)
      }
    })

    wss.close((err) => {
      if (err) console.error('Error closing WebSocket server:', err)
      else console.log('WebSocket server closed')
      pendingOps.ws = false
      checkComplete()
    })

    server.close((err) => {
      if (err) console.error('Error closing HTTP server:', err)
      else console.log('HTTP server closed')
      pendingOps.http = false
      checkComplete()
    })
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
})
