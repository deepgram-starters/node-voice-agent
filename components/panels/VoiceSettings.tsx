'use client'

import { Settings, Mic } from 'lucide-react'
import { useState } from 'react'

export function VoiceSettings() {
  const [voiceResponse, setVoiceResponse] = useState(true)
  const [wakeWord, setWakeWord] = useState(true)

  return (
    <div className="space-y-4">
      {/* Voice Response Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic size={14} className="text-text-secondary" />
          <span className="text-sm text-text-secondary">Voice Response</span>
        </div>
        <button
          onClick={() => setVoiceResponse(!voiceResponse)}
          className={`
            relative w-10 h-6 rounded-full transition-colors
            ${voiceResponse ? 'bg-orb-core/30' : 'bg-text-muted/20'}
          `}
          aria-label="Toggle voice response"
        >
          <div
            className={`
              absolute top-0.5 w-5 h-5 rounded-full transition-all
              ${voiceResponse ? 'right-0.5 bg-orb-core' : 'left-0.5 bg-text-muted'}
            `}
          />
        </button>
      </div>

      {/* Wake Word Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">Wake Word</span>
        <button
          onClick={() => setWakeWord(!wakeWord)}
          className={`
            relative w-10 h-6 rounded-full transition-colors
            ${wakeWord ? 'bg-orb-core/30' : 'bg-text-muted/20'}
          `}
          aria-label="Toggle wake word"
        >
          <div
            className={`
              absolute top-0.5 w-5 h-5 rounded-full transition-all
              ${wakeWord ? 'right-0.5 bg-orb-core' : 'left-0.5 bg-text-muted'}
            `}
          />
        </button>
      </div>

      {/* More Settings Link */}
      <button className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
        <Settings size={14} />
        More Settings
      </button>
    </div>
  )
}

export default VoiceSettings
