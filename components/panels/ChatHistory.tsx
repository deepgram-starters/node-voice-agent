'use client'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface ChatHistoryProps {
  messages?: Message[]
}

export function ChatHistory({ messages = [] }: ChatHistoryProps) {
  const defaultMessages: Message[] = [
    { role: 'assistant', content: "Hello! How can I help you today?", timestamp: "2m ago" },
    { role: 'user', content: "What's the weather like?", timestamp: "1m ago" },
    { role: 'assistant', content: "I can help you check the weather. What's your location?", timestamp: "1m ago" },
  ]

  const displayMessages = messages.length > 0 ? messages : defaultMessages

  return (
    <div className="space-y-3 max-h-[200px] overflow-y-auto">
      {displayMessages.map((msg, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-primary capitalize">
              {msg.role}
            </span>
            <span className="text-xs text-text-muted">{msg.timestamp}</span>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">
            {msg.content}
          </p>
        </div>
      ))}
    </div>
  )
}

export default ChatHistory
