'use client'

import { motion } from 'framer-motion'
import { useState, ReactNode } from 'react'
import { ChevronDown, X } from 'lucide-react'

interface GlassPanelProps {
  id: string
  title: string
  icon?: ReactNode
  children: ReactNode
  defaultPosition?: { x: number; y: number }
  draggable?: boolean
  resizable?: boolean
  collapsible?: boolean
  closable?: boolean
  onClose?: () => void
  className?: string
  headerAction?: ReactNode
}

export function GlassPanel({
  id,
  title,
  icon,
  children,
  defaultPosition = { x: 0, y: 0 },
  draggable = false,
  resizable = false,
  collapsible = true,
  closable = false,
  onClose,
  className = '',
  headerAction,
}: GlassPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
      className={`
        relative
        bg-white/75
        backdrop-blur-glass
        border border-white/40
        rounded-glass
        shadow-glass
        overflow-hidden
        ${className}
      `}
    >
      {/* Inner top highlight */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)' }}
      />

      {/* Header */}
      <div
        className={`
          flex items-center justify-between
          px-5 py-3
          border-b border-white/20
          ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}
        `}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-text-secondary">{icon}</span>}
          <h3 className="font-display font-semibold text-text-primary text-sm">
            {title}
          </h3>
        </div>

        <div className="flex items-center gap-1">
          {headerAction}

          {collapsible && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-lg hover:bg-white/30 transition-colors"
              aria-label={isCollapsed ? 'Expand' : 'Collapse'}
            >
              <motion.div
                animate={{ rotate: isCollapsed ? -90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown size={16} className="text-text-secondary" />
              </motion.div>
            </button>
          )}

          {closable && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/30 transition-colors"
              aria-label="Close panel"
            >
              <X size={16} className="text-text-secondary" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <motion.div
        initial={false}
        animate={{
          height: isCollapsed ? 0 : 'auto',
          opacity: isCollapsed ? 0 : 1,
        }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="overflow-hidden"
      >
        <div className="p-5">
          {children}
        </div>
      </motion.div>

      {/* Resize handle */}
      {resizable && !isCollapsed && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          style={{
            background: 'linear-gradient(135deg, transparent 50%, rgba(155, 155, 176, 0.3) 50%)',
          }}
        />
      )}
    </motion.div>
  )
}

export default GlassPanel
