// DOM Elements
const startButton = document.getElementById('startButton');
const statusBanner = document.getElementById('statusBanner');
const spinner = document.getElementById('spinner');
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
let audioQueue = [];
let isPlaying = false;

// Update status banner
function updateStatus(status, message) {
  statusBanner.className = `status-banner ${status}`;
  statusBanner.textContent = message;
}

// Add message to conversation history
function addMessage(role, content) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;

  const roleDiv = document.createElement('div');
  roleDiv.className = 'role';
  roleDiv.textContent = role === 'user' ? 'You' : 'Assistant';

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

// Play audio chunk
async function playNextInQueue() {
  if (audioQueue.length === 0) {
    isPlaying = false;
    return;
  }

  isPlaying = true;
  const audioData = audioQueue.shift();

  try {
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    // Create buffer with correct sample rate for agent's audio (24000Hz)
    const buffer = audioContext.createBuffer(1, audioData.length, 24000);
    const channelData = buffer.getChannelData(0);

    // Convert Int16 to Float32 with proper scaling
    for (let i = 0; i < audioData.length; i++) {
      channelData[i] = audioData[i] / (audioData[i] >= 0 ? 0x7FFF : 0x8000);
    }

    // Create and configure source
    const source = audioContext.createBufferSource();
    source.buffer = buffer;

    // Create gain node for volume control
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 1.0;

    // Connect nodes
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Handle playback completion
    source.onended = () => {
      playNextInQueue();
    };

    // Start playback
    source.start(0);
  } catch (error) {
    console.error('Error playing audio:', error);
    isPlaying = false;
    playNextInQueue();
  }
}

// Start audio streaming to server
function startStreaming() {
  if (!mediaStream || !isConnected) return;

  try {
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
    updateStatus('disconnected', 'Error: ' + error.message);
  }
}

// Stop audio streaming
function stopStreaming() {
  audioQueue = [];
  isPlaying = false;
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
    updateStatus('connecting', 'Requesting microphone access...');
    spinner.classList.remove('hidden');
    startButton.disabled = true;

    // Create audio context early with explicit sample rate
    audioContext = new AudioContext({ sampleRate: 24000 });

    // Browser-specific audio constraints
    let audioConstraints;

    if (isFirefox) {
      // Firefox ignores most constraints, use minimal approach
      audioConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
        // Firefox ignores sampleRate, channelCount, and other advanced constraints
      };
    } else {
      // Chrome/Edge/Safari: Full constraints with Google-specific options
      audioConstraints = {
        channelCount: 1,
        sampleRate: 24000,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        latency: 0,
        // Advanced Chrome/Edge constraints for better audio control
        googEchoCancellation: false,
        googAutoGainControl: false,
        googNoiseSuppression: false,
        googHighpassFilter: true
      };
    }

    const constraints = {
      audio: audioConstraints
    };

    mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

    if (isFirefox) {
      console.log('Firefox detected: Using minimal audio constraints');
    }

    updateStatus('connecting', 'Connecting to voice agent...');

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
      updateStatus('connected', 'Connected - Waiting for Welcome...');
    };

    socket.onmessage = async (event) => {
      // Handle both Blob and ArrayBuffer for better browser compatibility
      if (event.data instanceof Blob) {
        // Binary audio data as Blob (some browsers send as Blob)
        try {
          const arrayBuffer = await event.data.arrayBuffer();
          const audioData = new Int16Array(arrayBuffer);
          audioQueue.push(audioData);
          if (!isPlaying) {
            playNextInQueue();
          }
        } catch (error) {
          console.error('Error processing audio response:', error);
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Binary audio data as ArrayBuffer (direct binary)
        try {
          const audioData = new Int16Array(event.data);
          audioQueue.push(audioData);
          if (!isPlaying) {
            playNextInQueue();
          }
        } catch (error) {
          console.error('Error processing audio:', error);
        }
      } else {
        // JSON message
        try {
          const message = JSON.parse(event.data);
          console.log('Received message:', message);

          if (message.type === 'Welcome') {
            updateStatus('connected', 'Connected - Configuring...');

            // Send Settings message
            const settings = {
              type: 'Settings',
              audio: {
                input: {
                  encoding: 'linear16',
                  sample_rate: 24000
                },
                output: {
                  encoding: 'linear16',
                  sample_rate: 24000,
                  container: 'none'
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
                    model: 'aura-2-thalia-en'
                  }
                }
              }
            };

            socket.send(JSON.stringify(settings));
          } else if (message.type === 'SettingsApplied') {
            updateStatus('connected', 'Ready - Speak into your microphone');
            startStreaming();
          } else if (message.type === 'ConversationText') {
            // Add message to conversation history
            addMessage(message.role, message.content);
          } else if (message.type === 'Error') {
            console.error('Agent error:', message);
            updateStatus('disconnected', 'Error: ' + message.description);
          } else if (message.type === 'UserStartedSpeaking') {
            updateStatus('connected', 'Listening...');
          } else if (message.type === 'AgentThinking') {
            updateStatus('connected', 'Agent thinking...');
          } else if (message.type === 'AgentAudioDone') {
            updateStatus('connected', 'Ready - Speak into your microphone');
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      updateStatus('disconnected', 'Connection error');
      disconnect();
    };

    socket.onclose = () => {
      console.log('WebSocket closed');
      isConnected = false;
      updateStatus('disconnected', 'Disconnected');
      disconnect();
    };

  } catch (error) {
    console.error('Error connecting:', error);
    updateStatus('disconnected', 'Error: ' + error.message);
    disconnect();
  }
}

// Disconnect
function disconnect() {
  stopStreaming();

  if (socket) {
    socket.close();
    socket = null;
  }

  isConnected = false;
  spinner.classList.add('hidden');
  startButton.disabled = false;
  startButton.textContent = 'Start Conversation';
  updateStatus('disconnected', 'Disconnected');
}

// Button click handler
startButton.addEventListener('click', () => {
  if (!isConnected) {
    startButton.textContent = 'Connecting...';
    connect();
  } else {
    disconnect();
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  disconnect();
});
