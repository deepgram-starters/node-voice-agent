'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

type OrbState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface UseVoiceAgentReturn {
  orbState: OrbState
  messages: Message[]
  isConnected: boolean
  connect: () => void
  disconnect: () => void
  error: string | null
}

export function useVoiceAgent(): UseVoiceAgentReturn {
  const [orbState, setOrbState] = useState<OrbState>('idle')
  const [messages, setMessages] = useState<Message[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const socketRef = useRef<WebSocket | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const audioQueueRef = useRef<Int16Array[]>([])
  const isPlayingRef = useRef(false)

  const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setMessages(prev => [...prev, { role, content, timestamp }])
  }, [])

  const playNextInQueue = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false
      setOrbState('idle')
      return
    }

    isPlayingRef.current = true
    setOrbState('speaking')
    const audioData = audioQueueRef.current.shift()

    if (!audioData || !audioContextRef.current) return

    try {
      const audioContext = audioContextRef.current

      // Ensure audio context is running
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }

      // Create buffer with correct sample rate for agent's audio (24000Hz)
      const buffer = audioContext.createBuffer(1, audioData.length, 24000)
      const channelData = buffer.getChannelData(0)

      // Convert Int16 to Float32 with proper scaling
      for (let i = 0; i < audioData.length; i++) {
        channelData[i] = audioData[i] / (audioData[i] >= 0 ? 0x7FFF : 0x8000)
      }

      // Create and configure source
      const source = audioContext.createBufferSource()
      source.buffer = buffer

      // Create a gain node for volume control
      const gainNode = audioContext.createGain()
      gainNode.gain.value = 1.0

      // Connect nodes
      source.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // Handle playback completion
      source.onended = () => {
        playNextInQueue()
      }

      // Start playback
      source.start(0)
    } catch (error) {
      console.error('Error playing audio:', error)
      isPlayingRef.current = false
      playNextInQueue()
    }
  }, [])

  const startStreaming = useCallback(() => {
    if (!mediaStreamRef.current || !socketRef.current || !audioContextRef.current) return

    try {
      const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current)
      const bufferSize = 2048
      const processor = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1)

      source.connect(processor)
      processor.connect(audioContextRef.current.destination)

      let lastSendTime = 0
      const sendInterval = 100 // Send every 100ms

      processor.onaudioprocess = (e) => {
        const now = Date.now()
        if (socketRef.current?.readyState === WebSocket.OPEN && now - lastSendTime >= sendInterval) {
          const inputData = e.inputBuffer.getChannelData(0)
          const pcmData = new Int16Array(inputData.length)

          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]))
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
          }

          socketRef.current.send(pcmData.buffer)
          lastSendTime = now
        }
      }

      processorRef.current = processor
    } catch (error) {
      console.error('Error starting audio stream:', error)
      setError('Failed to start audio streaming')
    }
  }, [])

  const connect = useCallback(async () => {
    try {
      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: 24000 })

      // Get microphone permission
      const constraints = {
        audio: {
          channelCount: 1,
          sampleRate: 24000,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      }
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia(constraints)

      // Connect to WebSocket server
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${wsProtocol}//${window.location.host}`
      socketRef.current = new WebSocket(wsUrl)

      socketRef.current.onopen = () => {
        setIsConnected(true)
        setOrbState('listening')
        startStreaming()
      }

      socketRef.current.onmessage = async (event) => {
        if (event.data instanceof Blob) {
          try {
            const arrayBuffer = await event.data.arrayBuffer()
            const audioData = new Int16Array(arrayBuffer)
            audioQueueRef.current.push(audioData)

            if (!isPlayingRef.current) {
              playNextInQueue()
            }
          } catch (error) {
            console.error('Error processing audio response:', error)
          }
        }
      }

      socketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        setError('Connection error')
        setOrbState('error')
      }

      socketRef.current.onclose = () => {
        setIsConnected(false)
        setOrbState('idle')
        disconnect()
      }
    } catch (error) {
      console.error('Error connecting to voice agent:', error)
      setError('Failed to connect to voice agent')
      setOrbState('error')
    }
  }, [startStreaming, playNextInQueue])

  const disconnect = useCallback(() => {
    // Clear audio queue
    audioQueueRef.current = []
    isPlayingRef.current = false

    // Disconnect processor
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }

    // Close socket
    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }

    setIsConnected(false)
    setOrbState('idle')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    orbState,
    messages,
    isConnected,
    connect,
    disconnect,
    error,
  }
}

export default useVoiceAgent
