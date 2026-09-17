/**
 * Node Voice Agent Starter - Backend Server
 *
 * Bridges a browser WebSocket to Deepgram's Voice Agent API
 * (v1 agent, `wss://agent.deepgram.com/v1/agent/converse`) using the official
 * @deepgram/sdk `client.agent.v1` streaming support.
 *
 * The Deepgram side goes through the SDK, which manages the WebSocket, auth,
 * and binary-audio framing. The browser-facing side is unchanged:
 * the frontend sends a Settings message + live-update / inject control JSON and
 * binary mic audio, and receives Deepgram's binary agent audio + JSON events
 * exactly as before.
 *
 * Flow:
 *   browser --(JSON control: Settings / Update / Inject / ... + binary mic audio)--> backend --(SDK)--> Deepgram
 *   browser <--(binary agent audio + JSON events: Welcome / ConversationText / ...)-- backend <--(SDK)-- Deepgram
 *
 * Routes:
 *   GET  /api/session       - Issue JWT session token
 *   GET  /api/metadata      - Project metadata from deepgram.toml
 *   WS   /api/voice-agent   - WebSocket bridge to Deepgram Agent API (auth required)
 */

const { WebSocketServer, WebSocket } = require('ws');
const express = require('express');
const { createServer } = require('http');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const toml = require('toml');
const { DeepgramClient } = require('@deepgram/sdk');

// Validate required environment variables
if (!process.env.DEEPGRAM_API_KEY) {
  console.error('ERROR: DEEPGRAM_API_KEY environment variable is required');
  console.error('Please copy sample.env to .env and add your API key');
  process.exit(1);
}

// Configuration
const CONFIG = {
  deepgramApiKey: process.env.DEEPGRAM_API_KEY,
  port: process.env.PORT || 8081,
  host: process.env.HOST || '0.0.0.0',
};

function getErrorMessage(error, fallback) {
  return typeof error?.message === 'string' && error.message
    ? error.message
    : fallback;
}

// A single SDK client is reused across connections; auth is resolved from the
// API key here, so the browser never sees it.
//
// DEEPGRAM_BASE_URL (e.g. a staging host like wss://agent.staging.deepgram.com)
// overrides the default production endpoint. The SDK replaces its environment
// object wholesale rather than merging, so all four URL fields are set: the
// agent websocket uses `agent`, and `base`, `production`, and `agentRest`
// cover the REST and speech websocket paths.
const baseUrl = process.env.DEEPGRAM_BASE_URL;
const httpBaseUrl = baseUrl
  ? baseUrl.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://')
  : undefined;
const deepgram = new DeepgramClient({
  apiKey: CONFIG.deepgramApiKey,
  ...(baseUrl
    ? {
        environment: {
          base: httpBaseUrl,
          production: baseUrl,
          agent: baseUrl,
          agentRest: httpBaseUrl,
        },
      }
    : {}),
});
if (baseUrl) {
  console.log(`Using custom Deepgram base URL: ${baseUrl}`);
}

// ============================================================================
// SESSION AUTH - JWT tokens for production security
// ============================================================================

const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const JWT_EXPIRY = '1h';

/**
 * Validates JWT from WebSocket subprotocol: access_token.<jwt>
 * Returns the token string if valid, null if invalid.
 */
function validateWsToken(protocols) {
  if (!protocols) return null;
  const list = Array.isArray(protocols) ? protocols : protocols.split(',').map(s => s.trim());
  const tokenProto = list.find(p => p.startsWith('access_token.'));
  if (!tokenProto) return null;
  const token = tokenProto.slice('access_token.'.length);
  try {
    jwt.verify(token, SESSION_SECRET);
    return tokenProto;
  } catch {
    return null;
  }
}

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({
  noServer: true,
  handleProtocols: (protocols) => {
    // Accept the access_token.* subprotocol so the client sees it echoed back
    for (const proto of protocols) {
      if (proto.startsWith('access_token.')) return proto;
    }
    return false;
  },
});

// Track all active WebSocket connections for graceful shutdown
const activeConnections = new Set();

// Enable CORS
app.use(cors());

// ============================================================================
// SESSION ROUTES - Auth endpoints (unprotected)
// ============================================================================

/**
 * GET /api/session — Issues a signed JWT for session authentication.
 */
app.get('/api/session', (req, res) => {
  const token = jwt.sign(
    { iat: Math.floor(Date.now() / 1000) },
    SESSION_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
  res.json({ token });
});

/**
 * Metadata endpoint - required for standardization compliance
 */
app.get('/api/metadata', (req, res) => {
  try {
    const tomlPath = path.join(__dirname, 'deepgram.toml');
    const tomlContent = fs.readFileSync(tomlPath, 'utf-8');
    const config = toml.parse(tomlContent);

    if (!config.meta) {
      return res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Missing [meta] section in deepgram.toml'
      });
    }

    res.json(config.meta);
  } catch (error) {
    console.error('Error reading metadata:', error);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to read metadata from deepgram.toml'
    });
  }
});

/**
 * Forward a single Deepgram message to the browser.
 * Binary agent-audio frames go out as binary; parsed JSON events as JSON text.
 */
async function forwardToBrowser(clientWs, data) {
  if (clientWs.readyState !== WebSocket.OPEN) return;

  if (data instanceof ArrayBuffer) {
    clientWs.send(Buffer.from(data), { binary: true });
  } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
    // The SDK's Node socket delivers binary as a Blob; convert for `ws`.
    clientWs.send(Buffer.from(await data.arrayBuffer()), { binary: true });
  } else if (Buffer.isBuffer(data)) {
    clientWs.send(data, { binary: true });
  } else if (typeof data === 'string') {
    // Raw string (e.g. a control frame that failed JSON parsing) — pass through.
    clientWs.send(data);
  } else {
    // Parsed JSON event (Welcome / SettingsApplied / ConversationText / ...)
    clientWs.send(JSON.stringify(data));
  }
}

/**
 * WebSocket bridge handler — one Deepgram Agent connection per browser client.
 * The browser's control JSON is routed to the matching SDK method and mic audio
 * is forwarded via sendMedia; Deepgram's audio + events are forwarded back.
 */
wss.on('connection', async (clientWs, request) => {
  console.log('Client connected to /api/voice-agent');
  activeConnections.add(clientWs);

  // Buffer any browser messages that arrive before the Deepgram socket is open.
  let dgReady = false;
  const pending = [];

  // Create the Deepgram Agent connection object (not yet connected).
  //
  // reconnectAttempts: 0 disables the SDK's automatic reconnect. A reconnected
  // agent socket is a brand-new session that would need a fresh Settings
  // message, and by then the browser side has already been closed, so the SDK
  // default (30 retries) only opens orphan sessions while a browser's close
  // handshake is still in flight.
  let dgConn;
  try {
    console.log('Initiating Deepgram connection...');
    dgConn = await deepgram.agent.v1.createConnection({ reconnectAttempts: 0 });
  } catch (error) {
    console.error('Failed to create Deepgram connection:', getErrorMessage(error, 'connection failed'));
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'Error',
        description: 'Failed to establish proxy connection',
        code: 'CONNECTION_FAILED'
      }));
      clientWs.close();
    }
    activeConnections.delete(clientWs);
    return;
  }

  let clientClosing = false;
  function failClientConnection() {
    if (clientClosing || clientWs.readyState !== WebSocket.OPEN) return;

    clientClosing = true;
    const error = JSON.stringify({
      type: 'Error',
      description: 'Deepgram connection failed to open',
      code: 'CONNECTION_FAILED'
    });
    try {
      // Wait for the Error frame to flush before closing the browser socket.
      clientWs.send(error, () => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close(1011, 'Deepgram connection failed to open');
        }
      });
    } catch {
      clientWs.close(1011, 'Deepgram connection failed to open');
    }
  }

  // Route a control message from the browser to the matching SDK method. The
  // frontend's message objects carry the full payload (type + fields), so each
  // is passed through to the corresponding typed send method unchanged.
  function dispatchToDeepgram(msg) {
    try {
      switch (msg.type) {
        case 'Settings':
          dgConn.sendSettings(msg);
          break;
        case 'UpdateListen':
          dgConn.sendUpdateListen(msg);
          break;
        case 'UpdateThink':
          dgConn.sendUpdateThink(msg);
          break;
        case 'UpdateSpeak':
          dgConn.sendUpdateSpeak(msg);
          break;
        case 'UpdatePrompt':
          dgConn.sendUpdatePrompt(msg);
          break;
        case 'InjectUserMessage':
          dgConn.sendInjectUserMessage(msg);
          break;
        case 'InjectAgentMessage':
          dgConn.sendInjectAgentMessage(msg);
          break;
        case 'FunctionCallResponse':
          dgConn.sendFunctionCallResponse(msg);
          break;
        case 'KeepAlive':
          dgConn.sendKeepAlive({ type: 'KeepAlive' });
          break;
        default:
          console.warn('Ignoring unknown client message type:', msg.type);
      }
    } catch (error) {
      console.error('Failed to forward message to Deepgram:', error.message);
    }
  }

  // Deepgram -> browser (binary agent audio + JSON events)
  dgConn.on('open', () => {
    console.log('✓ Connected to Deepgram Agent API');
    // Deepgram sends the Welcome message automatically - it is forwarded on.
  });

  // Binary agent audio arrives from the SDK socket as a Blob and needs an async
  // conversion (`data.arrayBuffer()`) before it can be forwarded, while JSON
  // events (AgentAudioDone / ...) forward synchronously. Firing each forward
  // independently lets a synchronous event overtake the still-converting final
  // audio chunk, clipping the agent-audio tail. Serialize every forward through
  // a promise chain so the browser receives frames in the exact order Deepgram
  // sent them.
  let sendChain = Promise.resolve();
  dgConn.on('message', (data) => {
    sendChain = sendChain
      .then(() => forwardToBrowser(clientWs, data))
      .catch((err) => console.error('Failed to forward Deepgram message:', err));
  });

  dgConn.on('error', (error) => {
    const message = getErrorMessage(error, 'Deepgram connection error');
    console.error('Deepgram socket error:', message);
    if (dgReady && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'Error',
        description: message,
        code: 'PROVIDER_ERROR'
      }));
    }
  });

  dgConn.on('close', (event) => {
    const code = event?.code;
    const reason = typeof event?.reason === 'string' && event.reason
      ? event.reason
      : 'Deepgram connection closed';
    console.log(`Deepgram connection closed: ${code || 1000} ${reason}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      if (!dgReady) {
        failClientConnection();
        return;
      }

      // Reserved close codes cannot be sent by an application.
      const reservedCodes = [1004, 1005, 1006, 1015];
      const closeCode = typeof code === 'number' && code >= 1000 && code <= 4999 && !reservedCodes.includes(code)
        ? code
        : 1000;
      clientWs.close(closeCode, reason);
    }
  });

  // browser -> Deepgram. Binary frames are mic audio; text frames are JSON control.
  clientWs.on('message', (data, isBinary) => {
    if (isBinary) {
      if (!dgReady) {
        pending.push({ binary: true, data });
        return;
      }
      try {
        dgConn.sendMedia(data);
      } catch (error) {
        console.error('Failed to send audio to Deepgram:', error.message);
      }
      return;
    }

    // Text frame — a JSON control message.
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      console.warn('Ignoring non-JSON text message from client');
      return;
    }
    if (!dgReady) {
      pending.push({ binary: false, msg });
      return;
    }
    dispatchToDeepgram(msg);
  });

  // Handle client disconnect
  clientWs.on('close', (code, reason) => {
    console.log(`Client disconnected: ${code} ${reason}`);
    try {
      dgConn.close();
    } catch {
      // already closed
    }
    activeConnections.delete(clientWs);
  });

  // Handle client errors
  clientWs.on('error', (error) => {
    console.error('Client WebSocket error:', error);
    try {
      dgConn.close();
    } catch {
      // already closed
    }
  });

  // Open the Deepgram connection and flush anything the browser sent early.
  try {
    dgConn.connect();
    await dgConn.waitForOpen();
    dgReady = true;
    for (const item of pending) {
      if (item.binary) {
        try {
          dgConn.sendMedia(item.data);
        } catch (error) {
          console.error('Failed to send buffered audio to Deepgram:', error.message);
        }
      } else {
        dispatchToDeepgram(item.msg);
      }
    }
    pending.length = 0;
  } catch (error) {
    console.error('Deepgram connection did not open:', getErrorMessage(error, 'connection failed'));
    failClientConnection();
  }
});

/**
 * Handle WebSocket upgrade requests for /api/voice-agent.
 * Validates JWT from access_token.<jwt> subprotocol before upgrading.
 */
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;

  console.log(`WebSocket upgrade request for: ${pathname}`);

  if (pathname === '/api/voice-agent') {
    // Validate JWT from subprotocol
    const protocols = request.headers['sec-websocket-protocol'];
    const validProto = validateWsToken(protocols);
    if (!validProto) {
      console.log('WebSocket auth failed: invalid or missing token');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    console.log('Backend handling /api/voice-agent WebSocket (authenticated)');
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
    return;
  }

  // Unknown WebSocket path - reject
  console.log(`Unknown WebSocket path: ${pathname}`);
  socket.destroy();
});

/**
 * Graceful shutdown handler
 */
function gracefulShutdown(signal) {
  console.log(`\n${signal} signal received: starting graceful shutdown...`);

  // Stop accepting new connections
  wss.close(() => {
    console.log('WebSocket server closed to new connections');
  });

  // Close all active WebSocket connections
  console.log(`Closing ${activeConnections.size} active WebSocket connection(s)...`);
  activeConnections.forEach((ws) => {
    try {
      ws.close(1001, 'Server shutting down');
    } catch (error) {
      console.error('Error closing WebSocket:', error);
    }
  });

  // Close the HTTP server
  server.close(() => {
    console.log('HTTP server closed');
    console.log('Shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start server
server.listen(CONFIG.port, CONFIG.host, () => {
  console.log("\n" + "=".repeat(70));
  console.log(`🚀 Backend API Server running at http://localhost:${CONFIG.port}`);
  console.log("");
  console.log(`📡 GET  /api/session`);
  console.log(`📡 WS   /api/voice-agent (auth required)`);
  console.log(`📡 GET  /api/metadata`);
  console.log("=".repeat(70) + "\n");
});
