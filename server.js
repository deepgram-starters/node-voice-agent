/**
 * Node Voice Agent Starter - Backend Server
 *
 * This is a simple Express server that provides a voice agent API endpoint
 * powered by Deepgram's Voice Agent service. It's designed to be easily
 * modified and extended for your own projects.
 *
 * Key Features:
 * - Single API endpoint: POST /agent/converse
 * - Proxies to Vite dev server in development
 * - Serves static frontend in production
 * - Creates a WebSocket server for the voice agent
 */

import { createClient } from '@deepgram/sdk';
import { WebSocketServer } from 'ws';
import express from 'express';
import { createServer } from 'http';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  deepgramApiKey: process.env.DEEPGRAM_API_KEY,
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0',
  vitePort: process.env.VITE_PORT || 5173,
  isDevelopment: process.env.NODE_ENV === 'development',
};

// Validate required environment variables
if (!CONFIG.deepgramApiKey) {
  console.error('Error: DEEPGRAM_API_KEY not found in environment variables');
  process.exit(1);
}

// Initialize Express
const app = express();

// Development: Proxy to Vite dev server
// Production: Serve static files
if (CONFIG.isDevelopment) {
  console.log(`Development mode: Proxying to Vite dev server on port ${CONFIG.vitePort}`);
  app.use(
    '/',
    createProxyMiddleware({
      target: `http://localhost:${CONFIG.vitePort}`,
      changeOrigin: true,
      ws: true, // Enable WebSocket proxying for Vite HMR
    })
  );
} else {
  console.log('Production mode: Serving static files from frontend/dist');
  const distPath = path.join(__dirname, 'frontend', 'dist');
  app.use(express.static(distPath));
}

// Create HTTP server
const server = createServer(app);

// Create WebSocket server with path filtering
const wss = new WebSocketServer({
  server,
  path: '/agent/converse'
});

// Handle WebSocket connections
wss.on('connection', async (clientWs) => {
  console.log('Client connected to /agent/converse');

  let deepgramAgent = null;

  try {
    // Validate API key exists
    if (!CONFIG.deepgramApiKey) {
      clientWs.send(JSON.stringify({
        type: 'Error',
        description: 'Missing Deepgram API key',
        code: 'MISSING_API_KEY'
      }));
      clientWs.close();
      return;
    }

    // Initialize Deepgram client
    const deepgram = createClient(CONFIG.deepgramApiKey);

    // Create agent connection
    deepgramAgent = deepgram.agent();

    // Forward Welcome message from Deepgram to client
    deepgramAgent.on('Welcome', (data) => {
      if (clientWs.readyState === 1) { // WebSocket.OPEN
        clientWs.send(JSON.stringify(data));
      }
    });

    // Forward SettingsApplied message from Deepgram to client
    deepgramAgent.on('SettingsApplied', (data) => {
      if (clientWs.readyState === 1) {
        clientWs.send(JSON.stringify(data));
      }
    });

    // Forward ConversationText events from Deepgram to client
    deepgramAgent.on('ConversationText', (data) => {
      if (clientWs.readyState === 1) {
        clientWs.send(JSON.stringify(data));
      }
    });

    // Forward UserStartedSpeaking events from Deepgram to client
    deepgramAgent.on('UserStartedSpeaking', (data) => {
      if (clientWs.readyState === 1) {
        clientWs.send(JSON.stringify(data));
      }
    });

    // Forward AgentThinking events from Deepgram to client
    deepgramAgent.on('AgentThinking', (data) => {
      if (clientWs.readyState === 1) {
        clientWs.send(JSON.stringify(data));
      }
    });

    // Forward AgentAudioDone events from Deepgram to client
    deepgramAgent.on('AgentAudioDone', (data) => {
      if (clientWs.readyState === 1) {
        clientWs.send(JSON.stringify(data));
      }
    });

    // Forward audio chunks from Deepgram to client
    deepgramAgent.on('Audio', (audioData) => {
      if (clientWs.readyState === 1) {
        clientWs.send(audioData, { binary: true });
      }
    });

    // Forward Error events from Deepgram to client
    deepgramAgent.on('Error', (error) => {
      console.error('Deepgram agent error:', error);
      if (clientWs.readyState === 1) {
        // Map Deepgram errors to our error codes
        let errorCode = 'PROVIDER_ERROR';
        if (error.message && error.message.includes('auth')) {
          errorCode = 'MISSING_API_KEY';
        } else if (error.message && error.message.includes('audio')) {
          errorCode = 'AUDIO_FORMAT_ERROR';
        }

        clientWs.send(JSON.stringify({
          type: 'Error',
          description: error.message || 'Unknown error occurred',
          code: error.code || errorCode
        }));
      }
    });

    // Forward Warning events from Deepgram to client
    deepgramAgent.on('Warning', (data) => {
      if (clientWs.readyState === 1) {
        clientWs.send(JSON.stringify(data));
      }
    });

    // Handle agent close
    deepgramAgent.on('Close', () => {
      console.log('Deepgram agent connection closed');
      if (clientWs.readyState === 1) {
        clientWs.close();
      }
    });

    // Handle messages from client
    clientWs.on('message', async (data, isBinary) => {
      try {
        if (!deepgramAgent) {
          console.error('Deepgram agent not initialized');
          return;
        }

        if (isBinary) {
          // Binary audio data - validate and forward to Deepgram
          try {
            // Basic validation: check if data is not empty
            if (!data || data.byteLength === 0) {
              clientWs.send(JSON.stringify({
                type: 'Error',
                description: 'Invalid audio data: empty buffer',
                code: 'AUDIO_FORMAT_ERROR'
              }));
              return;
            }
            deepgramAgent.send(data);
          } catch (audioError) {
            console.error('Audio format error:', audioError);
            clientWs.send(JSON.stringify({
              type: 'Error',
              description: 'Invalid audio format',
              code: 'AUDIO_FORMAT_ERROR'
            }));
          }
        } else {
          // JSON message - parse and handle
          const message = JSON.parse(data.toString());

          if (message.type === 'Settings') {
            // Validate Settings message
            if (!message.audio || !message.agent) {
              clientWs.send(JSON.stringify({
                type: 'Error',
                description: 'Invalid Settings message: missing required fields',
                code: 'INVALID_SETTINGS'
              }));
              return;
            }

            // Validate audio configuration
            if (!message.audio.input || !message.audio.output) {
              clientWs.send(JSON.stringify({
                type: 'Error',
                description: 'Invalid Settings message: missing audio configuration',
                code: 'AUDIO_FORMAT_ERROR'
              }));
              return;
            }

            // Validate audio encoding and sample rate
            const validEncodings = ['linear16', 'linear32', 'mulaw'];
            if (!validEncodings.includes(message.audio.input.encoding) ||
              !validEncodings.includes(message.audio.output.encoding)) {
              clientWs.send(JSON.stringify({
                type: 'Error',
                description: 'Invalid audio encoding format',
                code: 'AUDIO_FORMAT_ERROR'
              }));
              return;
            }

            if (!message.agent.listen || !message.agent.think || !message.agent.speak) {
              clientWs.send(JSON.stringify({
                type: 'Error',
                description: 'Invalid Settings message: missing agent configuration',
                code: 'INVALID_SETTINGS'
              }));
              return;
            }

            // Configure the agent with the provided settings
            deepgramAgent.configure(message);
          } else {
            // Forward other JSON messages as-is
            deepgramAgent.send(data);
          }
        }
      } catch (error) {
        console.error('Error processing client message:', error);
        if (clientWs.readyState === 1) {
          clientWs.send(JSON.stringify({
            type: 'Error',
            description: error.message || 'Error processing message',
            code: 'CONNECTION_FAILED'
          }));
        }
      }
    });

    // Handle client disconnect
    clientWs.on('close', async () => {
      console.log('Client disconnected from /agent/converse');
      if (deepgramAgent) {
        try {
          await deepgramAgent.disconnect();
        } catch (error) {
          console.error('Error disconnecting Deepgram agent:', error);
        }
      }
    });

    // Handle client errors
    clientWs.on('error', (error) => {
      console.error('Client WebSocket error:', error);
    });

  } catch (error) {
    console.error('Error initializing agent connection:', error);
    if (clientWs.readyState === 1) {
      clientWs.send(JSON.stringify({
        type: 'Error',
        description: 'Failed to initialize agent connection',
        code: 'CONNECTION_FAILED'
      }));
      clientWs.close();
    }
  }
});

// Start the server
server.listen(CONFIG.port, CONFIG.host, () => {
  console.log(`Server running at http://localhost:${CONFIG.port}`);
  console.log(`WebSocket endpoint: ws://localhost:${CONFIG.port}/agent/converse`);
  if (CONFIG.isDevelopment) {
    console.log(`Make sure Vite dev server is running on port ${CONFIG.vitePort}`);
    console.log(`\n⚠️  Open your browser to http://localhost:${CONFIG.port}`);
  }
});

// Graceful shutdown
function shutdown() {
  console.log('\nShutting down server...');

  wss.clients.forEach((client) => {
    try {
      client.close();
    } catch (err) {
      console.error('Error closing client:', err);
    }
  });

  wss.close(() => {
    console.log('WebSocket server closed');
  });

  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 5 seconds
  setTimeout(() => {
    console.error('Force closing');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default server;
