// DOM Elements
const startButton = document.getElementById('startButton');
const endButton = document.getElementById('endButton');
const cancelButton = document.getElementById('cancelButton');
const sendButton = document.getElementById('sendButton');
const injectUserMessageInput = document.getElementById('injectUserMessageInput');
const statusBanner = document.getElementById('statusBanner');
const statusText = document.getElementById('statusText');
const conversationHistory = document.getElementById('conversationHistory');

// Browser detection
const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

// State
let socket = null;
let mediaStream = null;
let audioContext = null;
let processor = null;
let isConnected = false;
let isRecording = false;
let startTime = 0;
let scheduledAudioSources = [];

// Update status display
function updateStatus(status, message) {
  // Update status banner
  statusBanner.className = 'dg-status';

  if (status === 'connected') {
    statusBanner.classList.add('dg-status--success');
    startButton.disabled = true;
    endButton.disabled = false;
    sendButton.disabled = false;
    injectUserMessageInput.disabled = false;
  } else if (status === 'disconnected') {
    statusBanner.classList.add('dg-status--error');
    startButton.disabled = false;
    endButton.disabled = true;
    sendButton.disabled = true;
    injectUserMessageInput.disabled = true;
  } else if (status === 'connecting') {
    statusBanner.classList.add('dg-status--info');
    startButton.disabled = true;
    endButton.disabled = true;
    sendButton.disabled = true;
    injectUserMessageInput.disabled = true;
  } else if (status === 'error') {
    statusBanner.classList.add('dg-status--error');
    startButton.disabled = false;
    endButton.disabled = true;
    sendButton.disabled = true;
    injectUserMessageInput.disabled = true;
  }

  // Ensure statusText element exists and update message
  // Always re-query to avoid stale reference after innerHTML changes
  const currentStatusText = document.getElementById('statusText');
  if (!currentStatusText) {
    statusBanner.innerHTML = '<span id="statusText">' + message + '</span>';
  } else {
    currentStatusText.textContent = message;
  }
}

// Add message to conversation history
function addMessage(role, content) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;

  const roleDiv = document.createElement('div');
  roleDiv.className = 'role';
  roleDiv.textContent = role === 'user' ? 'You:' : 'Agent:';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'content';
  contentDiv.textContent = content;

  const timestampDiv = document.createElement('div');
  timestampDiv.className = 'timestamp';
  timestampDiv.textContent = new Date().toLocaleTimeString();

  messageDiv.appendChild(roleDiv);
  messageDiv.appendChild(contentDiv);
  messageDiv.appendChild(timestampDiv);

  conversationHistory.appendChild(messageDiv);
  conversationHistory.scrollTop = conversationHistory.scrollHeight;
}

// Convert Float32 PCM to Int16 PCM
function convertFloatToPcm(floatData) {
  const pcmData = new Int16Array(floatData.length);
  for (let i = 0; i < floatData.length; i++) {
    const s = Math.max(-1, Math.min(1, floatData[i]));
    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return pcmData;
}


// Play audio with scheduled timing (eliminates gaps between packets)
async function playAudio(audioData) {
  if (!audioContext) return;

  try {
    // #region agent log - REMOVE THIS
    const logId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const entryTime = audioContext.currentTime;
    fetch('http://127.0.0.1:7243/ingest/0ab9a2fa-7ce2-4b0f-8fe0-dd19b3e35560', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'main.js:playAudio_entry', message: 'Function entry', data: { logId, startTime, currentTime: entryTime, timeDiff: (startTime - entryTime), scheduledCount: scheduledAudioSources.length }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'A' }) }).catch(() => { });
    // #endregion

    // #region agent log
    const stateBeforeResume = audioContext.state;
    fetch('http://127.0.0.1:7243/ingest/0ab9a2fa-7ce2-4b0f-8fe0-dd19b3e35560', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'main.js:playAudio_state', message: 'AudioContext state check', data: { logId, state: stateBeforeResume, contextSampleRate: audioContext.sampleRate, bufferSampleRate: 24000, baseLatency: audioContext.baseLatency, outputLatency: audioContext.outputLatency }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'B,J' }) }).catch(() => { });
    // #endregion

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    // #region agent log - REMOVE THIS
    const byteView = new Uint8Array(audioData);
    const byteLength = audioData.byteLength;
    const first16Bytes = Array.from(byteView.slice(0, 16));
    const isEvenLength = byteLength % 2 === 0;
    fetch('http://127.0.0.1:7243/ingest/0ab9a2fa-7ce2-4b0f-8fe0-dd19b3e35560', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'main.js:playAudio_raw_bytes', message: 'Raw ArrayBuffer inspection', data: { logId, byteLength, isEvenLength, first16Bytes, wasReset: (startTime < audioContext.currentTime) }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'F,G,H' }) }).catch(() => { });
    // #endregion

    const audioDataView = new Int16Array(audioData);

    if (audioDataView.length === 0) {
      console.error('Received audio data is empty.');
      return;
    }

    // #region agent log - REMOVE THIS
    const firstInt16 = audioDataView[0];
    const lastInt16 = audioDataView[audioDataView.length - 1];
    const first4Samples = Array.from(audioDataView.slice(0, 4));
    fetch('http://127.0.0.1:7243/ingest/0ab9a2fa-7ce2-4b0f-8fe0-dd19b3e35560', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'main.js:playAudio_samples', message: 'Raw sample values', data: { logId, firstInt16, lastInt16, first4Samples, length: audioDataView.length }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'C,F' }) }).catch(() => { });
    // #endregion

    // Create buffer with correct sample rate for agent's audio (24000Hz)
    const audioBuffer = audioContext.createBuffer(1, audioDataView.length, 24000);
    const audioBufferChannel = audioBuffer.getChannelData(0);

    // Convert Int16 to Float32
    for (let i = 0; i < audioDataView.length; i++) {
      audioBufferChannel[i] = audioDataView[i] / 32768;
    }

    // #region agent log - REMOVE THIS
    const firstFloat32 = audioBufferChannel[0];
    const lastFloat32 = audioBufferChannel[audioBufferChannel.length - 1];
    fetch('http://127.0.0.1:7243/ingest/0ab9a2fa-7ce2-4b0f-8fe0-dd19b3e35560', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'main.js:playAudio_converted', message: 'Converted sample values', data: { logId, firstFloat32, lastFloat32, duration: audioBuffer.duration }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'C,E' }) }).catch(() => { });
    // #endregion

    // Create and configure source
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;

    // #region agent log - REMOVE THIS
    const beforeConnect = performance.now();
    // #endregion

    source.connect(audioContext.destination);

    // #region agent log - REMOVE THIS
    const afterConnect = performance.now();
    fetch('http://127.0.0.1:7243/ingest/0ab9a2fa-7ce2-4b0f-8fe0-dd19b3e35560', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'main.js:playAudio_connection', message: 'Source connection timing', data: { logId, connectDuration: (afterConnect - beforeConnect) }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'D' }) }).catch(() => { });
    // #endregion

    // Schedule audio at precise time to eliminate gaps
    const currentTime = audioContext.currentTime;
    const wasReset = startTime < currentTime;
    const oldStartTime = startTime;

    if (startTime < currentTime) {
      startTime = currentTime;
    }

    // #region agent log - REMOVE THIS
    fetch('http://127.0.0.1:7243/ingest/0ab9a2fa-7ce2-4b0f-8fe0-dd19b3e35560', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'main.js:playAudio_schedule', message: 'Scheduling audio', data: { logId, wasReset, oldStartTime, newStartTime: startTime, currentTime, gap: (startTime - currentTime) }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'I' }) }).catch(() => { });
    // #endregion

    source.start(startTime);

    // Update start time for next audio packet (seamless queueing)
    startTime = startTime + audioBuffer.duration;
    scheduledAudioSources.push(source);

    // #region agent log - REMOVE THIS
    fetch('http://127.0.0.1:7243/ingest/0ab9a2fa-7ce2-4b0f-8fe0-dd19b3e35560', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'main.js:playAudio_exit', message: 'Function exit', data: { logId, nextStartTime: startTime, totalScheduled: scheduledAudioSources.length }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'A' }) }).catch(() => { });
    // #endregion
  } catch (error) {
    console.error('Error playing audio:', error);
  }
}

// Clear all scheduled audio (called when user interrupts)
function clearScheduledAudio() {
  if (!audioContext) return;

  scheduledAudioSources.forEach((source) => {
    try {
      source.stop();
      source.onended = null;
    } catch (e) {
      // Source may have already ended or not started yet
    }
  });
  scheduledAudioSources = [];

  const scheduledAudioMs = Math.round(
    1000 * (startTime - audioContext.currentTime)
  );
  if (scheduledAudioMs > 0) {
    console.log(`Cleared ${scheduledAudioMs}ms of scheduled audio`);
  }

  startTime = 0;
}

// Start audio streaming to server
async function startStreaming() {
  if (!mediaStream || !isConnected) return;

  try {
    // Resume AudioContext if suspended (especially important for Firefox)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
      if (isFirefox) {
        // Give Firefox a moment to fully initialize
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const source = audioContext.createMediaStreamSource(mediaStream);

    // Create audio processor
    const bufferSize = 2048;
    processor = audioContext.createScriptProcessor(bufferSize, 1, 1);

    source.connect(processor);
    processor.connect(audioContext.destination);

    let lastSendTime = 0;
    const sendInterval = 100; // Send every 100ms

    processor.onaudioprocess = (e) => {
      const now = Date.now();
      if (socket?.readyState === WebSocket.OPEN && now - lastSendTime >= sendInterval) {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = convertFloatToPcm(inputData);
        socket.send(pcmData.buffer);
        lastSendTime = now;
      }
    };

    isRecording = true;
  } catch (error) {
    console.error('Error starting audio stream:', error);
    updateStatus('error', 'ERROR: ' + error.message);
  }
}

// Stop audio streaming
function stopStreaming() {
  isRecording = false;

  if (processor) {
    processor.disconnect();
    processor = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
}

// Connect to WebSocket
async function connect() {
  try {
    updateStatus('connecting', 'CONNECTING');

    // Create audio context
    // Firefox: Use native sample rate to avoid mismatch error
    // Chrome/Safari: Use 16000 Hz for microphone input
    if (isFirefox) {
      audioContext = new AudioContext({
      });
    } else {
      audioContext = new AudioContext({
        sampleRate: 16000,
        latencyHint: 'interactive' // Optimize for low latency real-time audio
      });
    }

    // Make audioContext globally accessible for debug tools - REMOVE THIS
    window.audioContext = audioContext;

    // Browser-specific audio constraints
    let audioConstraints;

    if (isFirefox) {
      audioConstraints = {
        channelCount: 1, // Force 1 channel for microphone input, mono recommended for better audio quality (not guaranteed in Firefox)
        echoCancellation: true, // set to true for desktop microphones also works with headsets
        noiseSuppression: false, // firefox ignores this
      };
    } else {
      // Chrome/Edge/Safari: Full constraints with Google-specific options
      audioConstraints = {
        channelCount: 1, // Force 1 channel for microphone input, mono recommended for better audio quality
        echoCancellation: true, // set to true for desktop microphones also works with headsets
        noiseSuppression: true, // set to true for desktop microphones also works with headsets
      };
    }

    const constraints = {
      audio: audioConstraints
    };

    mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

    updateStatus('connecting', 'CONNECTING');

    // Connect to WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/agent/converse`;
    socket = new WebSocket(wsUrl);

    // Set binary type - some browsers work better with 'blob', others with 'arraybuffer'
    // We handle both in onmessage for maximum compatibility
    socket.binaryType = 'arraybuffer';

    socket.onopen = () => {
      console.log('WebSocket connected');
      isConnected = true;
      // Don't update status here - wait for Welcome message
    };

    socket.onmessage = async (event) => {
      // Handle both Blob and ArrayBuffer for better browser compatibility
      if (event.data instanceof Blob) {
        // Binary audio data as Blob (some browsers send as Blob)
        try {
          const arrayBuffer = await event.data.arrayBuffer();
          playAudio(arrayBuffer);
        } catch (error) {
          console.error('Error processing audio response:', error);
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Binary audio data as ArrayBuffer (direct binary)
        try {
          playAudio(event.data);
        } catch (error) {
          console.error('Error processing audio:', error);
        }
      } else {
        // JSON message
        try {
          const message = JSON.parse(event.data);
          console.log('Received message:', message);

          if (message.type === 'Welcome') {
            updateStatus('connected', 'CONNECTED');

            // Send Settings message
            const settings = {
              type: 'Settings',
              audio: {
                input: {
                  encoding: 'linear16',
                  sample_rate: audioContext.sampleRate // Use actual AudioContext rate
                },
                output: {
                  encoding: 'linear16',
                  sample_rate: 24000, // Keep output at 24000 for all browsers
                  container: 'none' // Request raw PCM without container/headers for manual audio processing
                }
              },
              agent: {
                listen: {
                  provider: {
                    type: 'deepgram',
                    model: 'nova-3'
                  }
                },
                think: {
                  provider: {
                    type: 'open_ai',
                    model: 'gpt-4o-mini'
                  },
                  prompt: `You are a helpful voice assistant created by Deepgram. Your responses should be friendly, human-like, and conversational. Always keep your answers concise, limited to 1-2 sentences and no more than 120 characters.

When responding to a user's message, follow these guidelines:
- If the user's message is empty, respond with an empty message.
- Ask follow-up questions to engage the user, but only one question at a time.
- Keep your responses unique and avoid repetition.
- If a question is unclear or ambiguous, ask for clarification before answering.
- If asked about your well-being, provide a brief response about how you're feeling.

Remember that you have a voice interface. You can listen and speak, and all your responses will be spoken aloud.`
                },
                speak: {
                  provider: {
                    type: 'deepgram',
                    model: 'aura-2-luna-en'
                  }
                },
                greeting: "Hello! How can I help you today?" // test the greeting
              }
            };

            socket.send(JSON.stringify(settings));
          } else if (message.type === 'SettingsApplied') {
            updateStatus('connected', 'CONNECTED');
            startStreaming();
          } else if (message.type === 'ConversationText') {
            // Add message to conversation history
            addMessage(message.role, message.content);
          } else if (message.type === 'Error') {
            console.error('Agent error:', message);
            updateStatus('error', 'ERROR: ' + message.description);
          } else if (message.type === 'UserStartedSpeaking') {
            updateStatus('connected', 'CONNECTED');
          } else if (message.type === 'AgentThinking') {
            updateStatus('connected', 'CONNECTED');
          } else if (message.type === 'AgentAudioDone') {
            updateStatus('connected', 'CONNECTED');
            // #region agent log - REMOVE THIS
            fetch('http://127.0.0.1:7243/ingest/0ab9a2fa-7ce2-4b0f-8fe0-dd19b3e35560', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'main.js:AgentAudioDone', message: 'Phrase boundary - next audio will be new phrase', data: { startTime, currentTime: audioContext?.currentTime, scheduledCount: scheduledAudioSources.length }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'A,B' }) }).catch(() => { });
            // #endregion
          } else if (message.type === 'InjectionRefused') {
            console.warn('Message injection was refused - user may be speaking or agent responding');
            updateStatus('connected', 'CONNECTED - Message not sent (agent is speaking or user is talking)');
            // Auto-clear the status message after 3 seconds
            setTimeout(() => {
              updateStatus('connected', 'CONNECTED');
            }, 3000);
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      updateStatus('error', 'ERROR: Connection error');
      disconnect();
    };

    socket.onclose = () => {
      console.log('WebSocket closed');
      isConnected = false;
      updateStatus('disconnected', 'DISCONNECTED');
      disconnect();
    };

  } catch (error) {
    console.error('Error connecting:', error);
    updateStatus('error', 'ERROR: ' + error.message);
    disconnect();
  }
}

// Disconnect
function disconnect() {
  stopStreaming();
  clearScheduledAudio();

  if (socket) {
    socket.close();
    socket = null;
  }

  isConnected = false;
  updateStatus('disconnected', 'DISCONNECTED');
}

// Clear conversation history
function clearConversation() {
  conversationHistory.innerHTML = '';
}

// Button click handlers
startButton.addEventListener('click', () => {
  if (!isConnected) {
    connect();
  }
});

endButton.addEventListener('click', () => {
  if (isConnected) {
    disconnect();
  }
});

cancelButton.addEventListener('click', () => {
  disconnect();
  clearConversation();
});

sendButton.addEventListener('click', () => {
  sendTextMessage();
});

// Send text message via Enter key
injectUserMessageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !sendButton.disabled) {
    sendTextMessage();
  }
});

// Send text message to agent
function sendTextMessage() {
  const message = injectUserMessageInput.value.trim();

  if (!message || !socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }

  // Send InjectUserMessage to agent
  const injectMessage = {
    type: 'InjectUserMessage',
    content: message
  };

  socket.send(JSON.stringify(injectMessage));

  // Don't add to UI optimistically - wait for ConversationText event from Deepgram
  // This prevents duplicate messages when Deepgram echoes back the user message

  // Clear input
  injectUserMessageInput.value = '';
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  disconnect();
});
