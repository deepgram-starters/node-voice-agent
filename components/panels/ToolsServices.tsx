'use client'

import { Calendar, Rocket, Home, Heart, CheckSquare, MoreHorizontal } from 'lucide-react'
import { IconButton } from '../core/IconButton'

export function ToolsServices() {
  const tools = [
    { icon: <Calendar size={20} />, variant: 'calendar' as const, label: 'Calendar' },
    { icon: <Rocket size={20} />, variant: 'rocket' as const, label: 'Quick Actions' },
    { icon: <Home size={20} />, variant: 'home' as const, label: 'Home' },
    { icon: <Heart size={20} />, variant: 'heart' as const, label: 'Favorites' },
    { icon: <CheckSquare size={20} />, variant: 'check' as const, label: 'Tasks' },
    { icon: <MoreHorizontal size={20} />, variant: 'more' as const, label: 'More' },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {tools.map((tool) => (
        <IconButton
          key={tool.label}
          variant={tool.variant}
          icon={tool.icon}
          label={tool.label}
        />
      ))}
    </div>
  )
}

export default ToolsServices
