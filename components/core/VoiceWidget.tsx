'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { Mic } from 'lucide-react'

type WidgetState = 'inactive' | 'active' | 'minimized'

interface VoiceWidgetProps {
  state?: WidgetState
  onActivate?: () => void
  onExpand?: () => void
  className?: string
}

export function VoiceWidget({
  state = 'inactive',
  onActivate,
  onExpand,
  className = '',
}: VoiceWidgetProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`
        fixed bottom-6 right-6
        bg-white/75
        backdrop-blur-glass
        border border-white/40
        rounded-2xl
        shadow-glass
        overflow-hidden
        z-50
        ${className}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ minWidth: state === 'minimized' ? 56 : 200 }}
    >
      {/* Title bar with window controls */}
      <AnimatePresence>
        {state !== 'minimized' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center justify-end gap-1 px-2 py-1 border-b border-white/20"
          >
            <button className="w-3 h-3 rounded-full bg-text-muted/30 hover:bg-text-muted/50" />
            <button className="w-3 h-3 rounded-full bg-text-muted/30 hover:bg-text-muted/50" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={state === 'inactive' ? onActivate : onExpand}
      >
        {/* Mini orb */}
        <motion.div
          className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0"
          style={{
            background: 'radial-gradient(ellipse at 30% 30%, #7EE8FA 0%, #00D4E8 30%, #0A1628 80%)',
            boxShadow: state === 'active'
              ? '0 0 20px rgba(0, 212, 232, 0.5)'
              : '0 0 10px rgba(0, 212, 232, 0.3)',
          }}
          animate={state === 'active' ? {
            scale: [1, 1.05, 1],
            transition: { duration: 1.5, repeat: Infinity }
          } : {}}
        >
          {/* Starfield dots */}
          <div className="absolute inset-0 opacity-60">
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-0.5 h-0.5 bg-white rounded-full"
                style={{
                  left: `${20 + Math.random() * 60}%`,
                  top: `${20 + Math.random() * 60}%`,
                }}
                animate={{
                  opacity: [0.3, 1, 0.3],
                }}
                transition={{
                  duration: 1 + Math.random(),
                  repeat: Infinity,
                  delay: Math.random(),
                }}
              />
            ))}
          </div>

          {/* Brand */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white text-[8px] font-display font-semibold">
              Orbi.
            </span>
          </div>
        </motion.div>

        {/* Status and waveform */}
        <AnimatePresence>
          {state !== 'minimized' && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="flex flex-col gap-1"
            >
              {/* Waveform */}
              {state === 'active' && (
                <div className="flex items-center gap-0.5 h-4">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-0.5 bg-voice-active rounded-full"
                      animate={{
                        height: [4, 12 + Math.random() * 4, 4],
                      }}
                      transition={{
                        duration: 0.4 + Math.random() * 0.2,
                        repeat: Infinity,
                        delay: i * 0.1,
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Mic button for inactive state */}
              {state === 'inactive' && (
                <div className="w-8 h-8 rounded-full bg-orb-core/10 flex items-center justify-center">
                  <Mic size={14} className="text-orb-core" />
                </div>
              )}

              {/* Status label */}
              <span className="text-xs text-text-secondary whitespace-nowrap">
                Voice Agent - {state === 'active' ? 'Active' : 'Ready'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default VoiceWidget
