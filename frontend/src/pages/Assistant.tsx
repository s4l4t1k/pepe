import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Loader, Trash2, Spade, User } from 'lucide-react'
import { webAPI } from '../api/client'
import { useAuth } from '../store/auth'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const SUGGESTED_QUESTIONS = [
  'Как правильно защищать BB против стила?',
  'Когда делать overshove со стеком 15bb?',
  'Объясни GTO блефинг на ривере',
  'Как читать текстуру борда?',
  'VPIP/PFR — какие значения оптимальны для TAG?',
]

export default function Assistant() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (question?: string) => {
    const text = question || input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text, timestamp: new Date() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Build history for API (exclude timestamps)
    const history = messages.map((m) => ({ role: m.role, content: m.content }))

    try {
      const resp = await webAPI.askAssistant(text, history)
      const assistantMsg: Message = {
        role: 'assistant',
        content: resp.data.answer,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Не удалось получить ответ'
      const errorMsg: Message = {
        role: 'assistant',
        content: `Ошибка: ${detail}`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-4rem)] lg:max-h-screen">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-poker-border flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold">AI Тренер</h1>
          <p className="text-poker-text-muted text-sm mt-0.5">Задавай любые вопросы о покере</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-2 text-poker-text-muted hover:text-poker-danger transition-colors text-sm px-3 py-1.5 rounded-lg hover:bg-poker-danger/10"
          >
            <Trash2 className="w-4 h-4" />
            Очистить
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-8"
          >
            <div className="w-16 h-16 bg-poker-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Spade className="w-8 h-8 text-poker-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Привет, {user?.first_name}!</h3>
            <p className="text-poker-text-muted text-sm mb-6 max-w-sm mx-auto">
              Я твой покерный тренер. Задавай любые вопросы — отвечу с конкретными числами и диапазонами.
            </p>

            <div className="text-left max-w-md mx-auto">
              <p className="text-xs text-poker-text-muted uppercase tracking-wider mb-3 font-medium">
                Популярные вопросы:
              </p>
              <div className="space-y-2">
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    onClick={() => sendMessage(q)}
                    className="w-full text-left text-sm px-4 py-3 bg-poker-secondary border border-poker-border rounded-lg hover:border-poker-primary hover:bg-poker-primary/10 transition-all duration-200 text-poker-text"
                  >
                    {q}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                    msg.role === 'assistant'
                      ? 'bg-poker-primary/20 border border-poker-primary/30'
                      : 'bg-poker-secondary border border-poker-border'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <Spade className="w-4 h-4 text-poker-primary" />
                  ) : (
                    <User className="w-4 h-4 text-poker-text-muted" />
                  )}
                </div>

                {/* Bubble */}
                <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-poker-primary text-poker-bg rounded-tr-sm'
                        : 'bg-poker-card border border-poker-border text-poker-text rounded-tl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-xs text-poker-text-muted px-1">
                    {msg.role === 'assistant' ? 'AI Тренер' : user?.first_name} · {formatTime(msg.timestamp)}
                  </span>
                </div>
              </motion.div>
            ))}

            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <div className="w-8 h-8 rounded-full flex-shrink-0 bg-poker-primary/20 border border-poker-primary/30 flex items-center justify-center">
                  <Spade className="w-4 h-4 text-poker-primary" />
                </div>
                <div className="bg-poker-card border border-poker-border px-4 py-3 rounded-2xl rounded-tl-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-poker-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-poker-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-poker-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-poker-border flex-shrink-0">
        <div className="flex gap-3 items-end max-w-3xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Задай вопрос о покере..."
            rows={1}
            disabled={loading}
            className="input-field resize-none min-h-[48px] max-h-32 py-3 flex-1"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = Math.min(target.scrollHeight, 128) + 'px'
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="flex-shrink-0 w-12 h-12 bg-poker-primary hover:bg-poker-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-poker-bg rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
          >
            {loading ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-xs text-poker-text-muted text-center mt-2">
          Enter — отправить, Shift+Enter — новая строка
        </p>
      </div>
    </div>
  )
}
