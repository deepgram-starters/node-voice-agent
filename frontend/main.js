/**
 * Voice Agent Frontend
 *
 * Handles:
 * - WebSocket connection to Deepgram Voice Agent
 * - Microphone capture and audio streaming
 * - Audio playback of agent responses
 * - Chat interface and message handling
 * - Real-time status updates
 */

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const state = {
  ws: null,
  isConnected: false,
  audioContext: null,
  mediaStream: null,
  audioProcessor: null,
  audioQueue: [],
  isPlaying: false,
  stats: {
    messagesSent: 0,
    messagesReceived: 0,
    audioChunks: 0,
    sessionStart: null,
  },
  config: {
    listenModel: 'nova-2',
    speakModel: 'aura-asteria-en',
    thinkModel: 'gpt-4o-mini',
    systemPrompt: 'You are a helpful assistant.',
  },
  // Track original config when connected to detect changes
  originalConfig: null,
  hasUnsavedChanges: false,
};

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const elements = {
  // Forms and controls
  configForm: null,
  connectBtn: null,
  disconnectBtn: null,
  disconnectContainer: null,
  updateSettingsBtn: null,
  listenModel: null,
  speakModel: null,
  thinkModel: null,
  systemPrompt: null,

  // Chat interface
  connectOverlay: null,
  chatMessages: null,
  messageInput: null,
  sendBtn: null,

  // Status display
  connectionStatus: null,
  agentState: null,
  micStatus: null,
  messagesSent: null,
  messagesReceived: null,
  audioChunks: null,
  sessionDuration: null,

  // Metadata elements
  pageTitle: null,
  pageDescription: null,
  headerTitle: null,
  repoLink: null,
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initializeElements();
  initializeEventListeners();
  loadMetadata();
  updateSessionDuration();
});

function initializeElements() {
  // Config form
  elements.configForm = document.getElementById('configForm');
  elements.connectBtn = document.getElementById('connectBtn');
  elements.disconnectBtn = document.getElementById('disconnectBtn');
  elements.disconnectContainer = document.getElementById('disconnectContainer');
  elements.updateSettingsBtn = document.getElementById('updateSettingsBtn');
  elements.listenModel = document.getElementById('listenModel');
  elements.speakModel = document.getElementById('speakModel');
  elements.thinkModel = document.getElementById('thinkModel');
  elements.systemPrompt = document.getElementById('systemPrompt');

  // Chat interface
  elements.connectOverlay = document.getElementById('connectOverlay');
  elements.chatMessages = document.getElementById('chatMessages');
  elements.messageInput = document.getElementById('messageInput');
  elements.sendBtn = document.getElementById('sendBtn');

  // Status
  elements.connectionStatus = document.getElementById('connectionStatus');
  elements.agentState = document.getElementById('agentState');
  elements.micStatus = document.getElementById('micStatus');
  elements.messagesSent = document.getElementById('messagesSent');
  elements.messagesReceived = document.getElementById('messagesReceived');
  elements.audioChunks = document.getElementById('audioChunks');
  elements.sessionDuration = document.getElementById('sessionDuration');

  // Metadata
  elements.pageTitle = document.getElementById('pageTitle');
  elements.pageDescription = document.getElementById('pageDescription');
  elements.headerTitle = document.getElementById('headerTitle');
  elements.repoLink = document.getElementById('repoLink');
}

function initializeEventListeners() {
  // Connect button
  elements.connectBtn.addEventListener('click', connect);

  // Disconnect button
  elements.disconnectBtn.addEventListener('click', disconnect);

  // Update settings button
  elements.updateSettingsBtn.addEventListener('click', updateSettings);

  // Track changes in updateable config inputs (speak and prompt only)
  elements.speakModel.addEventListener('change', onConfigChange);
  elements.systemPrompt.addEventListener('input', onConfigChange);

  // Send message
  elements.sendBtn.addEventListener('click', sendTextMessage);
  elements.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  });

  // Microphone button removed - mic opens automatically on connect
}

// ============================================================================
// METADATA LOADING
// ============================================================================

async function loadMetadata() {
  try {
    const response = await fetch('/metadata');
    if (!response.ok) {
      console.warn('Failed to load metadata, using defaults');
      return;
    }

    const metadata = await response.json();

    // Update page title
    if (metadata.title && elements.pageTitle) {
      elements.pageTitle.textContent = metadata.title;
    }

    // Update page description
    if (metadata.description && elements.pageDescription) {
      elements.pageDescription.setAttribute('content', metadata.description);
    }

    // Update header title
    if (metadata.title && elements.headerTitle) {
      elements.headerTitle.textContent = metadata.title;
    }

    // Update repository link
    if (metadata.repository && elements.repoLink) {
      elements.repoLink.href = metadata.repository;
    }

    console.log('Metadata loaded:', metadata);
  } catch (error) {
    console.warn('Error loading metadata, using defaults:', error);
  }
}

// ============================================================================
// CONFIGURATION CHANGE TRACKING
// ============================================================================

function onConfigChange() {
  if (!state.isConnected || !state.originalConfig) return;

  // Only check updateable settings (speak model and system prompt)
  const hasChanges =
    elements.speakModel.value !== state.originalConfig.speakModel ||
    elements.systemPrompt.value !== state.originalConfig.systemPrompt;

  state.hasUnsavedChanges = hasChanges;
  elements.updateSettingsBtn.disabled = !hasChanges;

  // Toggle visibility based on changes
  if (hasChanges) {
    elements.updateSettingsBtn.classList.remove('hidden');
  } else {
    elements.updateSettingsBtn.classList.add('hidden');
  }
}

function updateSettings() {
  if (!state.isConnected || !state.hasUnsavedChanges) return;

  const currentConfig = {
    listenModel: elements.listenModel.value,
    speakModel: elements.speakModel.value,
    thinkModel: elements.thinkModel.value,
    systemPrompt: elements.systemPrompt.value,
  };

  // Send update messages only for updateable settings
  if (currentConfig.speakModel !== state.originalConfig.speakModel) {
    sendMessage({
      type: 'UpdateSpeak',
      speak: {
        provider: {
          type: 'deepgram',
          model: currentConfig.speakModel,
        },
      },
    });
    addSystemMessage('🔊 Updating voice model...');
  }

  if (currentConfig.systemPrompt !== state.originalConfig.systemPrompt) {
    sendMessage({
      type: 'UpdatePrompt',
      prompt: currentConfig.systemPrompt,
    });
    addSystemMessage('🧠 Updating system prompt...');
  }

  // Update original config
  state.originalConfig = { ...currentConfig };
  state.config = { ...currentConfig };
  state.hasUnsavedChanges = false;
  elements.updateSettingsBtn.disabled = true;
  elements.updateSettingsBtn.classList.add('hidden');
}

// ============================================================================
// WEBSOCKET CONNECTION
// ============================================================================

async function connect() {
  if (state.isConnected) return;

  // Get configuration from form
  state.config.listenModel = elements.listenModel.value;
  state.config.speakModel = elements.speakModel.value;
  state.config.thinkModel = elements.thinkModel.value;
  state.config.systemPrompt = elements.systemPrompt.value;

  // Update UI
  elements.connectBtn.disabled = true;
  elements.connectBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting...';

  try {
    // Connect to WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/agent/converse`;

    state.ws = new WebSocket(wsUrl);
    state.ws.binaryType = 'arraybuffer';

    state.ws.onopen = handleWebSocketOpen;
    state.ws.onmessage = handleWebSocketMessage;
    state.ws.onclose = handleWebSocketClose;
    state.ws.onerror = handleWebSocketError;

  } catch (error) {
    console.error('Connection error:', error);
    showError('Failed to connect to server');
    // Reset button state
    elements.connectBtn.disabled = false;
    elements.connectBtn.innerHTML = '<i class="fa-solid fa-plug"></i> Connect';
  }
}

function handleWebSocketOpen() {
  console.log('WebSocket connected, waiting for Welcome message...');
  updateAgentState('Connecting...');
}

function handleWebSocketMessage(event) {
  // Try to parse as JSON first
  if (typeof event.data === 'string' || event.data instanceof ArrayBuffer) {
    try {
      const text = typeof event.data === 'string'
        ? event.data
        : new TextDecoder().decode(event.data);
      const message = JSON.parse(text);
      // Count JSON messages only
      state.stats.messagesReceived++;
      updateStats();
      handleJSONMessage(message);
      return;
    } catch (e) {
      // Not JSON, must be binary audio
      handleBinaryAudio(event.data);
    }
  }
}

function handleJSONMessage(message) {
  console.log('Received:', message.type);

  switch (message.type) {
    case 'Welcome':
      addSystemMessage('✓ WebSocket connected');
      sendSettings();
      break;

    case 'SettingsApplied':
      addSystemMessage('✓ Configuration applied');
      onConnected();
      break;

    case 'ConversationText':
      // Display conversation text in chat
      if (message.role === 'assistant' && message.content) {
        addChatMessage('agent', message.content);
      } else if (message.role === 'user' && message.content) {
        addChatMessage('user', message.content);
      }
      break;

    case 'UserStartedSpeaking':
      updateAgentState('Listening...');
      break;

    case 'AgentThinking':
      addSystemMessage('💭 Agent is thinking...');
      updateAgentState('Thinking...');
      break;

    case 'AgentStartedSpeaking':
      updateAgentState('Speaking...');
      break;

    case 'AgentAudioDone':
      updateAgentState('Ready');
      break;

    case 'FunctionCallRequest':
      addSystemMessage('🔧 Function call requested');
      updateAgentState('Calling function...');
      break;

    case 'FunctionCallResponse':
      addSystemMessage('✓ Function call completed');
      break;

    case 'PromptUpdated':
      addSystemMessage('✓ System prompt updated');
      break;

    case 'SpeakUpdated':
      addSystemMessage('✓ Voice configuration updated');
      break;

    case 'Warning':
      console.warn('Agent warning:', message);
      addSystemMessage(`⚠️ ${message.description || 'Warning from agent'}`, 'warning');
      break;

    case 'Error':
      console.error('Agent error:', message);
      addSystemMessage(`❌ ${message.description || 'An error occurred'}`, 'error');
      showError(message.description || 'Agent error occurred');

      // Handle timeout errors by disconnecting
      if (message.code === 'CLIENT_MESSAGE_TIMEOUT') {
        disconnect();
      } else {
        updateAgentState('Error');
      }
      break;

    default:
      console.log('Unhandled message type:', message.type, message);
  }
}

function handleBinaryAudio(arrayBuffer) {
  state.stats.audioChunks++;
  updateStats();

  // Queue audio for playback
  state.audioQueue.push(arrayBuffer);

  // Start playback if not already playing
  if (!state.isPlaying) {
    playNextAudio();
  }
}

function handleWebSocketClose(event) {
  console.log('WebSocket closed:', event.code, event.reason);
  disconnect();
}

function handleWebSocketError(error) {
  console.error('WebSocket error:', error);
  showError('WebSocket connection error');
}

function sendSettings() {
  const settingsMessage = {
    type: 'Settings',
    audio: {
      input: {
        encoding: 'linear16',
        sample_rate: 16000,
      },
      output: {
        encoding: 'linear16',
        sample_rate: 16000,
      },
    },
    agent: {
      listen: {
        provider: {
          type: 'deepgram',
          version: 'v1',
          model: state.config.listenModel,
        },
      },
      speak: {
        provider: {
          type: 'deepgram',
          model: state.config.speakModel,
        },
      },
      think: {
        provider: {
          type: 'open_ai',
          model: state.config.thinkModel,
        },
        prompt: state.config.systemPrompt,
      },
    },
  };

  sendMessage(settingsMessage);
  addSystemMessage('⚙️ Initializing voice agent...');
  updateAgentState('Configuring...');
}

function sendMessage(message) {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(message));
    state.stats.messagesSent++;
    updateStats();
  }
}

async function onConnected() {
  state.isConnected = true;
  state.stats.sessionStart = Date.now();

  // Store original config for change tracking
  state.originalConfig = {
    listenModel: elements.listenModel.value,
    speakModel: elements.speakModel.value,
    thinkModel: elements.thinkModel.value,
    systemPrompt: elements.systemPrompt.value,
  };

  // Update UI
  elements.connectOverlay.classList.add('hidden');
  elements.disconnectContainer.classList.remove('hidden');
  elements.updateSettingsBtn.classList.add('hidden'); // Hidden until changes made
  elements.updateSettingsBtn.disabled = true;

  // Enable controls
  elements.messageInput.disabled = false;
  elements.sendBtn.disabled = false;

  // Disable non-updateable config inputs (listen and think cannot be changed mid-conversation)
  elements.listenModel.disabled = true;
  elements.thinkModel.disabled = true;
  // Speak and prompt stay enabled for live updates

  // Update status
  updateConnectionStatus(true);
  updateAgentState('Requesting microphone...');

  // Initialize audio context
  await initializeAudioContext();

  // Automatically open microphone
  await startMicrophone();
}

function disconnect() {
  // Close WebSocket
  if (state.ws) {
    state.ws.close();
    state.ws = null;
  }

  // Stop microphone and audio processor
  if (state.audioProcessor) {
    state.audioProcessor.disconnect();
    state.audioProcessor = null;
  }
  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach(track => track.stop());
    state.mediaStream = null;
  }

  // Close audio context
  if (state.audioContext) {
    state.audioContext.close();
    state.audioContext = null;
  }

  // Reset state completely
  state.isConnected = false;
  state.audioQueue = [];
  state.isPlaying = false;
  state.originalConfig = null;
  state.hasUnsavedChanges = false;
  state.stats = {
    messagesSent: 0,
    messagesReceived: 0,
    audioChunks: 0,
    sessionStart: null,
  };

  // Update UI
  elements.connectOverlay.classList.remove('hidden');
  elements.disconnectContainer.classList.add('hidden');
  elements.updateSettingsBtn.classList.add('hidden');
  elements.updateSettingsBtn.disabled = true;

  // Reset connect button
  elements.connectBtn.disabled = false;
  elements.connectBtn.innerHTML = '<i class="fa-solid fa-plug"></i> Connect';

  // Disable controls
  elements.messageInput.disabled = true;
  elements.messageInput.value = '';
  elements.sendBtn.disabled = true;

  // Clear chat messages
  elements.chatMessages.innerHTML = '';

  // Re-enable all config inputs
  elements.listenModel.disabled = false;
  elements.thinkModel.disabled = false;

  // Update status
  updateConnectionStatus(false);
  updateMicrophoneStatus(false);
  updateAgentState('Idle');
  updateStats();
}

// ============================================================================
// AUDIO CONTEXT & PLAYBACK
// ============================================================================

async function initializeAudioContext() {
  if (!state.audioContext) {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000,
    });
  }
}

async function playNextAudio() {
  if (state.audioQueue.length === 0) {
    state.isPlaying = false;
    return;
  }

  state.isPlaying = true;
  const arrayBuffer = state.audioQueue.shift();

  try {
    if (!state.audioContext) {
      await initializeAudioContext();
    }

    // Convert ArrayBuffer to AudioBuffer
    const audioBuffer = await arrayBufferToAudioBuffer(arrayBuffer);

    // Play the audio
    const source = state.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(state.audioContext.destination);
    source.onended = () => playNextAudio();
    source.start(0);

  } catch (error) {
    console.error('Audio playback error:', error);
    // Continue with next audio
    playNextAudio();
  }
}

async function arrayBufferToAudioBuffer(arrayBuffer) {
  // Convert raw PCM16 to AudioBuffer
  const pcm16 = new Int16Array(arrayBuffer);
  const audioBuffer = state.audioContext.createBuffer(
    1, // mono
    pcm16.length,
    16000 // sample rate
  );

  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < pcm16.length; i++) {
    channelData[i] = pcm16[i] / 32768; // Convert to float [-1, 1]
  }

  return audioBuffer;
}

// ============================================================================
// MICROPHONE CAPTURE
// ============================================================================

async function startMicrophone() {
  if (!state.isConnected || state.mediaStream) return;

  // Set a timeout for microphone permission
  const timeoutId = setTimeout(() => {
    if (!state.mediaStream) {
      console.error('Microphone permission timeout');
      addSystemMessage('❌ Microphone access timed out', 'error');
      showError('Please allow microphone access and try again');
      disconnect();
    }
  }, 10000); // 10 second timeout

  try {
    // Get microphone access
    state.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    // Clear timeout since we got permission
    clearTimeout(timeoutId);

    // Create audio processing pipeline
    if (!state.audioContext) {
      await initializeAudioContext();
    }

    const source = state.audioContext.createMediaStreamSource(state.mediaStream);
    state.audioProcessor = state.audioContext.createScriptProcessor(4096, 1, 1);

    state.audioProcessor.onaudioprocess = (e) => {
      if (!state.isConnected) return;

      const inputData = e.inputBuffer.getChannelData(0);

      // Convert float32 to int16
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Send binary audio to WebSocket
      if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(pcm16.buffer);
      }
    };

    source.connect(state.audioProcessor);
    state.audioProcessor.connect(state.audioContext.destination);

    // Agent is now ready to use
    updateMicrophoneStatus(true);
    updateAgentState('Ready');
    addSystemMessage('🎤 Microphone active - ready to talk');
    console.log('Microphone opened, voice agent ready');

  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Microphone error:', error);
    addSystemMessage('❌ Microphone access denied', 'error');
    showError('Please allow microphone access and try again');
    disconnect();
  }
}

// ============================================================================
// CHAT INTERFACE
// ============================================================================

function sendTextMessage() {
  const text = elements.messageInput.value.trim();
  if (!text || !state.isConnected) return;

  // Send InjectUserMessage
  const message = {
    type: 'InjectUserMessage',
    content: text,
  };

  sendMessage(message);

  // Clear input
  elements.messageInput.value = '';
  elements.messageInput.style.height = 'auto';
}

function addChatMessage(sender, text) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message chat-message--${sender}`;

  const avatar = document.createElement('div');
  avatar.className = 'chat-message__avatar';
  avatar.innerHTML = sender === 'agent'
    ? '<i class="fa-solid fa-robot"></i>'
    : '<i class="fa-solid fa-user"></i>';

  const bubble = document.createElement('div');
  bubble.className = 'chat-message__bubble';
  bubble.textContent = text;

  messageDiv.appendChild(avatar);
  messageDiv.appendChild(bubble);

  elements.chatMessages.appendChild(messageDiv);

  // Scroll to bottom smoothly
  messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function addSystemMessage(text, type = 'info') {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message--system';
  messageDiv.textContent = text;

  if (type === 'error') {
    messageDiv.style.color = 'var(--dg-error, #ff4444)';
  } else if (type === 'warning') {
    messageDiv.style.color = 'var(--dg-warning, #ffa500)';
  }

  elements.chatMessages.appendChild(messageDiv);

  // Scroll to bottom smoothly
  messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

// ============================================================================
// UI UPDATES
// ============================================================================

function updateConnectionStatus(connected) {
  if (connected) {
    elements.connectionStatus.className = 'status-badge status-badge--connected';
    elements.connectionStatus.innerHTML = `
      <span class="status-indicator status-indicator--connected"></span>
      Connected
    `;
  } else {
    elements.connectionStatus.className = 'status-badge status-badge--disconnected';
    elements.connectionStatus.innerHTML = `
      <span class="status-indicator status-indicator--disconnected"></span>
      Disconnected
    `;
  }
}

function updateAgentState(stateName) {
  elements.agentState.textContent = stateName;
}

function updateMicrophoneStatus(active) {
  if (active) {
    elements.micStatus.textContent = 'Active';
    elements.micStatus.classList.add('status-item__value--success');
  } else {
    elements.micStatus.textContent = 'Inactive';
    elements.micStatus.classList.remove('status-item__value--success');
  }
}

function updateStats() {
  elements.messagesSent.textContent = state.stats.messagesSent;
  elements.messagesReceived.textContent = state.stats.messagesReceived;
  elements.audioChunks.textContent = state.stats.audioChunks;
}

function updateSessionDuration() {
  if (state.stats.sessionStart) {
    const elapsed = Math.floor((Date.now() - state.stats.sessionStart) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    elements.sessionDuration.textContent =
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    elements.sessionDuration.textContent = '00:00';
  }

  // Update every second
  setTimeout(updateSessionDuration, 1000);
}

function showError(message) {
  console.error(message);
  // Could add a toast notification here
}
