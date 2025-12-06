'use client'

import { motion } from 'framer-motion'

export function AmbientBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(
            135deg,
            var(--surface-lavender) 0%,
            var(--surface-rose) 35%,
            var(--surface-cream) 70%,
            var(--surface-lavender) 100%
          )`,
          backgroundSize: '400% 400%',
        }}
        animate={{
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Flowing wave shapes */}
      <svg
        className="absolute inset-0 w-full h-full opacity-30"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="wave1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--surface-lavender)" />
            <stop offset="100%" stopColor="var(--surface-rose)" />
          </linearGradient>
          <linearGradient id="wave2" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--surface-rose)" />
            <stop offset="100%" stopColor="var(--surface-cream)" />
          </linearGradient>
        </defs>

        <motion.path
          d="M0,450 Q360,300 720,450 T1440,450 V900 H0 Z"
          fill="url(#wave1)"
          animate={{
            d: [
              'M0,450 Q360,300 720,450 T1440,450 V900 H0 Z',
              'M0,450 Q360,600 720,450 T1440,450 V900 H0 Z',
              'M0,450 Q360,300 720,450 T1440,450 V900 H0 Z',
            ],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        <motion.path
          d="M0,550 Q360,400 720,550 T1440,550 V900 H0 Z"
          fill="url(#wave2)"
          animate={{
            d: [
              'M0,550 Q360,400 720,550 T1440,550 V900 H0 Z',
              'M0,550 Q360,700 720,550 T1440,550 V900 H0 Z',
              'M0,550 Q360,400 720,550 T1440,550 V900 H0 Z',
            ],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </svg>

      {/* Subtle noise texture */}
      <div
        className="absolute inset-0 opacity-[0.015] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  )
}

export default AmbientBackground
