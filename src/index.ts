import { createClient, AgentEvents } from '@deepgram/sdk';
import { WebSocket } from 'ws';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

if (!DEEPGRAM_API_KEY) {
  console.error('Please set your DEEPGRAM_API_KEY in the .env file');
  process.exit(1);
}

// Initialize Deepgram
const deepgram = createClient(DEEPGRAM_API_KEY);

// Create HTTP server to serve the static HTML file
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    fs.readFile(path.join(__dirname, '../static/index.html'), (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading index.html');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  }
});

// Function to connect to Deepgram Voice Agent
async function connectToAgent(browserWs: WebSocket) {
  try {
    // Create an agent connection
    const agent = deepgram.agent();

    // Set up event handlers
    agent.on(AgentEvents.Open, () => {
      console.log('Agent connection established');
    });

    // Forward Welcome message to browser
    // Browser should then send Settings message to configure the agent
    agent.on('Welcome', (data) => {
      console.log('Deepgram welcome message received:', data);

      // Forward Welcome to browser
      if (browserWs?.readyState === WebSocket.OPEN) {
        browserWs.send(JSON.stringify({
          type: 'Welcome',
          ...data
        }));
      }

      // Note: Browser must now send Settings message to configure the agent
      console.log('Waiting for Settings message from browser...');
    });

    // Forward SettingsApplied message to browser
    agent.on('SettingsApplied', (data) => {
      console.log('Deepgram settings applied:', data);
      if (browserWs?.readyState === WebSocket.OPEN) {
        browserWs.send(JSON.stringify({
          type: 'SettingsApplied',
          ...data
        }));
      }
    });

    // Forward UserStartedSpeaking to browser
    agent.on(AgentEvents.UserStartedSpeaking, (data: any) => {
      console.log('User started speaking');
      if (browserWs?.readyState === WebSocket.OPEN) {
        browserWs.send(JSON.stringify({
          type: 'UserStartedSpeaking',
          ...data
        }));
      }
    });

    // Forward AgentThinking to browser
    agent.on(AgentEvents.AgentThinking, (data: any) => {
      console.log('Agent thinking');
      if (browserWs?.readyState === WebSocket.OPEN) {
        browserWs.send(JSON.stringify({
          type: 'AgentThinking',
          ...data
        }));
      }
    });

    // Forward AgentAudioDone to browser
    agent.on(AgentEvents.AgentAudioDone, (data: any) => {
      console.log('Agent audio done');
      if (browserWs?.readyState === WebSocket.OPEN) {
        browserWs.send(JSON.stringify({
          type: 'AgentAudioDone',
          ...data
        }));
      }
    });

    agent.on(AgentEvents.AgentStartedSpeaking, (data: { total_latency: number }) => {
      console.log('Agent started speaking');
    });

    // Forward ConversationText to browser
    agent.on(AgentEvents.ConversationText, (message: { role: string; content: string }) => {
      console.log(`${message.role}: ${message.content}`);
      if (browserWs?.readyState === WebSocket.OPEN) {
        browserWs.send(JSON.stringify({
          type: 'ConversationText',
          ...message
        }));
      }
    });

    agent.on(AgentEvents.Audio, (audio: Buffer) => {
      if (browserWs?.readyState === WebSocket.OPEN) {
        try {
          // Send the audio buffer directly without additional conversion
          browserWs.send(audio, { binary: true });
        } catch (error) {
          console.error('Error sending audio to browser:', error);
        }
      }
    });

    // Forward Error to browser
    agent.on(AgentEvents.Error, (error: any) => {
      // Ignore race condition errors when browser already disconnected
      const isDisconnectRaceCondition =
        error.message === 'WebSocket was closed before the connection was established' &&
        browserWs?.readyState !== WebSocket.OPEN;

      if (isDisconnectRaceCondition) {
        // This is expected when tests disconnect quickly before Deepgram connects
        return;
      }

      console.error('Agent error received from Deepgram:', {
        message: error.message || error.description,
        code: error.code,
        type: error.type
      });

      if (browserWs?.readyState === WebSocket.OPEN) {
        browserWs.send(JSON.stringify({
          type: 'Error',
          description: error.description || error.message || 'An error occurred',
          code: error.code || error.type || 'UNKNOWN_ERROR'
        }));
      }
    });

    // Forward Warning to browser
    agent.on('Warning', (warning: any) => {
      console.warn('Agent warning:', warning);
      if (browserWs?.readyState === WebSocket.OPEN) {
        browserWs.send(JSON.stringify({
          type: 'Warning',
          description: warning.message || 'A warning occurred',
          code: warning.code || 'UNKNOWN_WARNING'
        }));
      }
    });

    agent.on(AgentEvents.Close, () => {
      console.log('Agent connection closed');
      if (browserWs?.readyState === WebSocket.OPEN) {
        browserWs.close();
      }
    });

    return agent;
  } catch (error) {
    console.error('Error connecting to Deepgram:', error);
    process.exit(1);
  }
}

// Create WebSocket server for browser clients on /agent/converse path
const wss = new WebSocket.Server({
  server,
  path: '/agent/converse'
});

wss.on('connection', async (ws) => {
  console.log('Browser client connected');

  // Immediately connect to Deepgram Agent API
  // Pass the WebSocket so agent handlers can send to THIS specific client
  const agent = await connectToAgent(ws);

  // Forward messages from browser to Deepgram agent
  ws.on('message', (data: any) => {
    try {
      if (!agent) return;

      // Try to parse as JSON (for Settings messages)
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'Settings') {
          // Forward Settings message using configure()
          console.log('Forwarding Settings to Deepgram:', message);
          agent.configure(message);
          return;
        }
      } catch (parseError) {
        // Not JSON, treat as audio data
      }

      // Forward audio data using send()
      agent.send(data);
    } catch (error) {
      console.error('Error forwarding message to agent:', error);
    }
  });

  ws.on('close', async () => {
    if (agent) {
      try {
        // Try to disconnect, but handle race condition if connection isn't fully established
        await agent.disconnect();
      } catch (error) {
        // Ignore "WebSocket was closed before the connection was established" errors
        // This happens when the browser disconnects before Deepgram connection completes
        console.log('Agent disconnect handled (may not have been fully connected)');
      }
    }
    console.log('Browser client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
const serverInstance = server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Graceful shutdown handler
function shutdown() {
  console.log('\nShutting down server...');

  // Set a timeout to force exit if graceful shutdown takes too long
  const forceExit = setTimeout(() => {
    console.error('Force closing due to timeout');
    process.exit(1);
  }, 5000);

  // Track pending operations
  let pendingOps = {
    ws: true,
    http: true
  };

  // Function to check if all operations are complete
  const checkComplete = () => {
    if (!pendingOps.ws && !pendingOps.http) {
      clearTimeout(forceExit);
      console.log('Server shutdown complete');
      process.exit(0);
    }
  };

  // Close all WebSocket connections
  wss.clients.forEach((client) => {
    try {
      client.close();
    } catch (err) {
      console.error('Error closing WebSocket client:', err);
    }
  });

  wss.close((err) => {
    if (err) {
      console.error('Error closing WebSocket server:', err);
    } else {
      console.log('WebSocket server closed');
    }
    pendingOps.ws = false;
    checkComplete();
  });

  // Close the HTTP server
  serverInstance.close((err) => {
    if (err) {
      console.error('Error closing HTTP server:', err);
    } else {
      console.log('HTTP server closed');
    }
    pendingOps.http = false;
    checkComplete();
  });
}

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default serverInstance;