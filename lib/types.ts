export type OrbState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error'

export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface VoiceAgentConfig {
  apiKey: string
  agentModel?: string
  sttModel?: string
  ttsModel?: string
  greeting?: string
  sampleRate?: number
  encoding?: string
}

export interface AudioConfig {
  sampleRate: number
  encoding: string
  channelCount: number
  echoCancellation: boolean
  noiseSuppression: boolean
  autoGainControl: boolean
}
