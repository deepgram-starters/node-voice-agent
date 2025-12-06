'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { MessageSquare, FolderOpen, Settings, Link2 } from 'lucide-react'

import { VoiceOrb } from '../core/VoiceOrb'
import { GlassPanel } from '../core/GlassPanel'
import { VoiceWidget } from '../core/VoiceWidget'
import { AmbientBackground } from './AmbientBackground'
import { ChatHistory } from '../panels/ChatHistory'
import { ToolsServices } from '../panels/ToolsServices'
import { DocumentsFiles } from '../panels/DocumentsFiles'
import { VoiceSettings } from '../panels/VoiceSettings'
import { useVoiceAgent } from '@/hooks/useVoiceAgent'

type ViewMode = 'dashboard' | 'widget'
type OrbState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error'

export function Dashboard() {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard')
  const {
    orbState,
    messages,
    connect,
    disconnect,
    isConnected
  } = useVoiceAgent()

  const handleOrbClick = () => {
    if (!isConnected) {
      connect()
    }
  }

  const handleWidgetExpand = () => {
    setViewMode('dashboard')
  }

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <AmbientBackground />

      <AnimatePresence mode="wait">
        {viewMode === 'dashboard' ? (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative w-full h-full flex items-center justify-center p-8"
          >
            {/* Central Orb */}
            <div className="absolute z-10">
              <VoiceOrb
                state={orbState}
                size="lg"
                onClick={handleOrbClick}
              />
            </div>

            {/* Panels Grid */}
            <div className="absolute inset-8 grid grid-cols-[320px_1fr_320px] grid-rows-[1fr_1fr] gap-6 pointer-events-none">
              {/* Top Left - Chat History */}
              <div className="pointer-events-auto">
                <GlassPanel
                  id="chat-history"
                  title="Chat History"
                  icon={<MessageSquare size={16} />}
                >
                  <ChatHistory messages={messages} />
                </GlassPanel>
              </div>

              {/* Top Center - spacer for orb */}
              <div />

              {/* Top Right - Documents & Files */}
              <div className="pointer-events-auto">
                <GlassPanel
                  id="documents-files"
                  title="Documents & Files"
                  icon={<FolderOpen size={16} />}
                  headerAction={
                    <button className="p-1.5 rounded-lg hover:bg-white/30 transition-colors">
                      <Link2 size={14} className="text-text-secondary" />
                    </button>
                  }
                >
                  <DocumentsFiles />
                </GlassPanel>
              </div>

              {/* Bottom Left - Tools & Services */}
              <div className="pointer-events-auto self-end">
                <GlassPanel
                  id="tools-services"
                  title="Tools & Services"
                  icon={<Link2 size={16} />}
                  headerAction={
                    <button className="p-1.5 rounded-lg hover:bg-white/30 transition-colors">
                      <Link2 size={14} className="text-text-secondary" />
                    </button>
                  }
                >
                  <ToolsServices />
                </GlassPanel>
              </div>

              {/* Bottom Center - spacer */}
              <div />

              {/* Bottom Right - Voice & Settings */}
              <div className="pointer-events-auto self-end">
                <GlassPanel
                  id="voice-settings"
                  title="Voice & Settings"
                  icon={<Settings size={16} />}
                >
                  <VoiceSettings />
                </GlassPanel>
              </div>
            </div>

            {/* Minimize to widget button */}
            <motion.button
              className="absolute bottom-6 right-6 px-4 py-2 bg-white/75 backdrop-blur-glass border border-white/40 rounded-full text-sm text-text-secondary hover:text-text-primary transition-colors"
              onClick={() => setViewMode('widget')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Minimize
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key="widget"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative w-full h-full"
          >
            <VoiceWidget
              state={orbState === 'idle' ? 'inactive' : 'active'}
              onActivate={handleOrbClick}
              onExpand={handleWidgetExpand}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Dashboard
