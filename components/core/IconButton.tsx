'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

type IconVariant = 'calendar' | 'rocket' | 'home' | 'heart' | 'check' | 'more' | 'custom'

interface IconButtonProps {
  variant?: IconVariant
  icon: ReactNode
  onClick?: () => void
  label?: string
  customBg?: string
  customColor?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const variantStyles: Record<IconVariant, { bg: string; color: string }> = {
  calendar: { bg: '#E8E0FF', color: '#8B7EC8' },
  rocket: { bg: '#FFE8F0', color: '#FF8FAB' },
  home: { bg: '#FFF0E0', color: '#FFB366' },
  heart: { bg: '#FFE0E8', color: '#FF7B9C' },
  check: { bg: '#E0FFF0', color: '#7ED9A6' },
  more: { bg: '#F0F0F8', color: '#9B9BB0' },
  custom: { bg: '#F0F0F8', color: '#6B6B8D' },
}

const sizeStyles = {
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-14 h-14',
}

export function IconButton({
  variant = 'custom',
  icon,
  onClick,
  label,
  customBg,
  customColor,
  size = 'md',
  className = '',
}: IconButtonProps) {
  const styles = variantStyles[variant]
  const bg = customBg || styles.bg
  const color = customColor || styles.color

  return (
    <motion.button
      onClick={onClick}
      className={`
        ${sizeStyles[size]}
        rounded-button
        flex items-center justify-center
        transition-all duration-200
        hover:shadow-md
        focus:outline-none focus:ring-2 focus:ring-orb-core/30
        ${className}
      `}
      style={{ backgroundColor: bg, color }}
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      aria-label={label}
    >
      {icon}
    </motion.button>
  )
}

export default IconButton
