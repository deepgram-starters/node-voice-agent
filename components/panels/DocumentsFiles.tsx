'use client'

import { FileText, Folder, File, Image } from 'lucide-react'

export function DocumentsFiles() {
  const files = [
    { icon: <FileText size={24} />, bg: '#FFE8E8', color: '#FF7B7B', label: 'PDF' },
    { icon: <Folder size={24} />, bg: '#FFF0E0', color: '#FFB366', label: 'Folder' },
    { icon: <File size={24} />, bg: '#E8F4FF', color: '#7EB8FF', label: 'Doc' },
    { icon: <FileText size={24} />, bg: '#F8E8FF', color: '#C490E4', label: 'Notes' },
    { icon: <File size={24} />, bg: '#E8F4FF', color: '#7EB8FF', label: 'Sheet' },
    { icon: <Image size={24} />, bg: '#E8FFE8', color: '#7ED9A6', label: 'Image' },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {files.map((file, i) => (
        <button
          key={i}
          className="w-14 h-14 rounded-xl flex items-center justify-center transition-all hover:scale-105 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-orb-core/30"
          style={{ backgroundColor: file.bg, color: file.color }}
          aria-label={file.label}
        >
          {file.icon}
        </button>
      ))}
    </div>
  )
}

export default DocumentsFiles
