'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useRef, useEffect, useState } from 'react'

type OrbState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error'

interface VoiceOrbProps {
  state?: OrbState
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  className?: string
}

const sizeMap = {
  sm: 80,
  md: 200,
  lg: 280,
}

export function VoiceOrb({
  state = 'idle',
  size = 'lg',
  onClick,
  className = ''
}: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [particles, setParticles] = useState<Array<{x: number; y: number; vx: number; vy: number}>>([])
  const diameter = sizeMap[size]

  // Initialize starfield particles
  useEffect(() => {
    const newParticles = Array.from({ length: 50 }, () => ({
      x: Math.random() * diameter,
      y: Math.random() * diameter,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
    }))
    setParticles(newParticles)
  }, [diameter])

  // Animate starfield
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    const center = diameter / 2

    const animate = () => {
      ctx.clearRect(0, 0, diameter, diameter)

      // Draw gradient background
      const gradient = ctx.createRadialGradient(
        center * 0.6, center * 0.6, 0,
        center, center, center
      )
      gradient.addColorStop(0, '#7EE8FA')
      gradient.addColorStop(0.3, '#00D4E8')
      gradient.addColorStop(0.7, '#0A1628')
      gradient.addColorStop(1, '#050A12')

      ctx.beginPath()
      ctx.arc(center, center, center - 2, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()

      // Draw stars
      particles.forEach((p) => {
        // Update position based on state
        const speed = state === 'processing' ? 2 : 0.3
        p.x += p.vx * speed
        p.y += p.vy * speed

        // Wrap around
        if (p.x < 0) p.x = diameter
        if (p.x > diameter) p.x = 0
        if (p.y < 0) p.y = diameter
        if (p.y > diameter) p.y = 0

        // Only draw if inside circle
        const dx = p.x - center
        const dy = p.y - center
        if (dx * dx + dy * dy < (center - 10) * (center - 10)) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, state === 'processing' ? 1.5 : 1, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + Math.random() * 0.7})`
          ctx.fill()
        }
      })

      animationId = requestAnimationFrame(animate)
    }

    animate()
    return () => cancelAnimationFrame(animationId)
  }, [diameter, particles, state])

  const glowVariants = {
    idle: {
      boxShadow: '0 0 40px rgba(0, 212, 232, 0.4), 0 0 80px rgba(126, 232, 250, 0.2)'
    },
    listening: {
      boxShadow: [
        '0 0 40px rgba(0, 212, 232, 0.4), 0 0 80px rgba(126, 232, 250, 0.2)',
        '0 0 80px rgba(0, 212, 232, 0.7), 0 0 120px rgba(126, 232, 250, 0.4)',
        '0 0 40px rgba(0, 212, 232, 0.4), 0 0 80px rgba(126, 232, 250, 0.2)'
      ],
      transition: { duration: 1.5, repeat: Infinity }
    },
    processing: {
      boxShadow: '0 0 60px rgba(0, 212, 232, 0.5), 0 0 100px rgba(126, 232, 250, 0.3)'
    },
    speaking: {
      boxShadow: '0 0 50px rgba(0, 229, 204, 0.5), 0 0 90px rgba(126, 232, 250, 0.3)'
    },
    error: {
      boxShadow: '0 0 60px rgba(255, 123, 123, 0.5), 0 0 100px rgba(255, 123, 123, 0.2)'
    }
  }

  return (
    <motion.div
      className={`relative cursor-pointer select-none ${className}`}
      style={{ width: diameter, height: diameter }}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Outer glow container */}
      <motion.div
        className="absolute inset-0 rounded-full"
        variants={glowVariants}
        animate={state}
      />

      {/* Pulsing rings (listening state) */}
      <AnimatePresence>
        {state === 'listening' && (
          <>
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-full border-2 border-orb-halo"
                initial={{ scale: 0.8, opacity: 0.8 }}
                animate={{ scale: 1.5, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.6,
                  ease: 'easeOut'
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Main orb */}
      <motion.div
        className="relative w-full h-full rounded-full overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(126, 232, 250, 0.3) 0%, transparent 50%)',
          border: '1px solid rgba(126, 232, 250, 0.3)',
        }}
        animate={
          state === 'idle' ? { scale: [1, 1.02, 1] } :
          state === 'listening' ? { scale: [1, 1.05, 1] } :
          state === 'processing' ? { rotate: 360 } :
          state === 'speaking' ? { scale: [1, 1.03, 0.98, 1] } :
          state === 'error' ? { scale: [1, 1.1, 1] } :
          {}
        }
        transition={
          state === 'idle' ? { duration: 4, repeat: Infinity, ease: "easeInOut" } :
          state === 'listening' ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } :
          state === 'processing' ? { duration: 2, repeat: Infinity, ease: "linear" } :
          state === 'speaking' ? { duration: 0.3, repeat: Infinity } :
          state === 'error' ? { duration: 0.5, repeat: 1 } :
          {}
        }
      >
        <canvas
          ref={canvasRef}
          width={diameter}
          height={diameter}
          className="w-full h-full"
        />

        {/* Inner highlight */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(145deg, rgba(255,255,255,0.2) 0%, transparent 50%)',
            pointerEvents: 'none'
          }}
        />

        {/* Brand text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-display font-semibold text-white drop-shadow-lg"
            style={{ fontSize: diameter * 0.14 }}
          >
            Orbi.
          </span>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default VoiceOrb
