import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader, ChevronDown, ChevronUp, Send, Trash2, Spade, User as UserIcon,
  BookOpen, CheckCircle2, Circle, ChevronRight, ChevronLeft,
  Trophy, Lightbulb, Target, Brain, Paperclip, MessageSquare,
} from 'lucide-react'
import { webAPI, AnalysisResult, ModuleItem, LessonContent } from '../api/client'
import { useAuth } from '../store/auth'

type Tab = 'chat' | 'training'

// ── Shared ────────────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: string | null }) {
  if (!score) return null
  const lower = score.toLowerCase()
  if (lower.includes('хорошо') || lower.includes('good'))
    return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">{score}</span>
  if (lower.includes('удовлетворительно') || lower.includes('ok'))
    return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">{score}</span>
  return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-500/15 text-red-400 border border-red-500/25">{score}</span>
}

// ── Chat Tab ──────────────────────────────────────────────────────────────────

type MsgType = 'text' | 'analysis' | 'image'
interface Message {
  role: 'user' | 'assistant'
  type: MsgType
  content: string
  analysis?: AnalysisResult
  imagePreview?: string
  timestamp: Date
}

const SUGGESTED = [
  'Как правильно защищать BB против стила?',
  'Когда делать overshove со стеком 15bb?',
  'Объясни GTO блефинг на ривере',
  'Как читать текстуру борда?',
  'VPIP/PFR — какие значения оптимальны для TAG?',
]

function InlineAnalysis({ a }: { a: AnalysisResult }) {
  const [expanded, setExpanded] = useState(true)
  const fields = [
    { label: 'Префлоп', val: a.preflop },
    { label: 'Флоп', val: a.flop },
    { label: 'Тёрн', val: a.turn },
    { label: 'Ривер', val: a.river },
  ].filter(f => f.val)

  return (
    <div className="space-y-2.5 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-green-200">Разбор раздачи</span>
          {a.overall_score && <ScoreBadge score={a.overall_score} />}
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-[#2d5a2d] hover:text-green-400 transition-colors">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }}
            className="space-y-2">
            {fields.map(f => (
              <div key={f.label} className="bg-[#1a3a1a]/40 rounded-lg px-3 py-2 border border-[#1a3a1a]">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#4a8a4a]">{f.label}: </span>
                <span className="text-xs text-green-200 leading-relaxed">{f.val}</span>
              </div>
            ))}
            {a.main_leak && (
              <div className="px-3 py-2 bg-red-950/30 border border-red-900/40 rounded-lg">
                <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">Утечка: </span>
                <span className="text-xs text-red-300">{a.main_leak}</span>
              </div>
            )}
            {a.recommended_line && (
              <div className="px-3 py-2 bg-emerald-950/30 border border-emerald-900/40 rounded-lg">
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Линия: </span>
                <span className="text-xs text-emerald-300">{a.recommended_line}</span>
              </div>
            )}
            {a.ev_estimate && (
              <div className="text-xs font-mono text-amber-400 opacity-80 px-1">{a.ev_estimate}</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ChatTab({ dailyRemaining, dailyLimit, onAnalyzed }: {
  dailyRemaining: number
  dailyLimit: number
  onAnalyzed: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const addMsg = (msg: Message) => setMessages(prev => [...prev, msg])

  const send = async (q?: string) => {
    const text = q || input.trim()
    if (!text || loading) return
    addMsg({ role: 'user', type: 'text', content: text, timestamp: new Date() })
    setInput(''); setLoading(true)

    try {
      try {
        const resp = await webAPI.analyzeHand(text)
        addMsg({ role: 'assistant', type: 'analysis', content: '', analysis: resp.data.analysis, timestamp: new Date() })
        onAnalyzed()
      } catch (e: any) {
        if (e?.response?.status === 422) {
          const history = messages.map(m => ({ role: m.role, content: m.content }))
          const resp = await webAPI.askAssistant(text, history)
          addMsg({ role: 'assistant', type: 'text', content: resp.data.answer, timestamp: new Date() })
        } else {
          throw e
        }
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail || 'Не удалось получить ответ'
      addMsg({ role: 'assistant', type: 'text', content: `Ошибка: ${detail}`, timestamp: new Date() })
    } finally { setLoading(false); inputRef.current?.focus() }
  }

  const sendImage = async (file: File) => {
    if (loading) return
    const preview = URL.createObjectURL(file)
    addMsg({ role: 'user', type: 'image', content: file.name, imagePreview: preview, timestamp: new Date() })
    setLoading(true)
    try {
      const resp = await webAPI.analyzeScreenshot(file)
      addMsg({ role: 'assistant', type: 'analysis', content: '', analysis: resp.data.analysis, timestamp: new Date() })
      onAnalyzed()
    } catch (e: any) {
      const detail = e?.response?.data?.detail || 'Ошибка анализа скриншота'
      addMsg({ role: 'assistant', type: 'text', content: `Ошибка: ${detail}`, timestamp: new Date() })
    } finally { setLoading(false) }
  }

  const fmt = (d: Date) => d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
  const limitColor = dailyRemaining <= 3 ? 'text-red-400' : dailyRemaining <= 7 ? 'text-amber-400' : 'text-green-400'

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 210px)', minHeight: 420 }}>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) { sendImage(f); e.target.value = '' } }} />

      {/* Daily limit */}
      <div className="flex items-center justify-between bg-[#0d1d0d] border border-[#1a3a1a] rounded-xl px-4 py-2 mb-3 flex-shrink-0">
        <span className="text-xs text-[#4a8a4a]">Анализов сегодня</span>
        <span className={`text-xs font-semibold ${limitColor}`}>{dailyRemaining} / {dailyLimit} осталось</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="py-2 text-center">
            <div className="w-14 h-14 bg-amber-500/15 rounded-2xl flex items-center justify-center mb-4 mx-auto border border-amber-500/20">
              <Spade className="w-7 h-7 text-amber-500" />
            </div>
            <h3 className="font-bold text-white mb-2">Привет, {user?.first_name}!</h3>
            <p className="text-sm text-[#4a8a4a] mb-1 max-w-sm mx-auto leading-relaxed">
              Я твой покерный тренер. Задавай любые вопросы —
              отвечу с конкретными числами и диапазонами.
            </p>
            <p className="text-xs text-[#2d5a2d] mb-6">📎 Скрепка — для скриншота · Вставь раздачу — разберу</p>
            <div className="space-y-2 max-w-sm mx-auto text-left">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#2d5a2d] mb-3">Популярные вопросы:</p>
              {SUGGESTED.map((q, i) => (
                <motion.button key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                  onClick={() => send(q)}
                  className="w-full text-left text-sm px-4 py-3 bg-[#0d1d0d] border border-[#1a3a1a] rounded-xl hover:border-green-700/50 hover:bg-green-900/10 transition-all text-[#4a8a4a] hover:text-green-300">
                  {q}
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${
                  msg.role === 'assistant' ? 'bg-amber-500/15 border border-amber-500/25' : 'bg-[#1a3a1a] border border-[#2a5a2a]'
                }`}>
                  {msg.role === 'assistant' ? <Spade className="w-3.5 h-3.5 text-amber-500" /> : <UserIcon className="w-3.5 h-3.5 text-green-400" />}
                </div>
                <div className={`max-w-[85%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.type === 'image' && msg.imagePreview && (
                    <img src={msg.imagePreview} alt="скриншот" className="max-w-[180px] rounded-xl border border-[#1a3a1a] mb-1" />
                  )}
                  {msg.type === 'analysis' && msg.analysis ? (
                    <div className="bg-[#0d1d0d] border border-[#1a3a1a] rounded-2xl rounded-tl-sm p-4 max-w-sm w-full">
                      <InlineAnalysis a={msg.analysis} />
                    </div>
                  ) : msg.type !== 'image' || msg.content ? (
                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-amber-500 text-zinc-900 rounded-tr-sm font-medium'
                        : 'bg-[#0d1d0d] border border-[#1a3a1a] text-green-100 rounded-tl-sm'
                    }`}>
                      {msg.content}
                    </div>
                  ) : null}
                  <span className="text-[10px] text-[#2d5a2d] px-1">
                    {msg.role === 'assistant' ? 'Виктор' : user?.first_name} · {fmt(msg.timestamp)}
                  </span>
                </div>
              </motion.div>
            ))}

            {loading && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                  <Spade className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="bg-[#0d1d0d] border border-[#1a3a1a] px-4 py-3 rounded-2xl rounded-tl-sm">
                  <div className="flex items-center gap-1">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={endRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2 items-end border-t border-[#1a3a1a] pt-3 flex-shrink-0">
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#0d1d0d] border border-[#1a3a1a] flex items-center justify-center text-[#2d5a2d] hover:text-red-400 hover:border-red-900 transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={() => fileInputRef.current?.click()} disabled={loading}
          className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#0d1d0d] border border-[#1a3a1a] flex items-center justify-center text-[#3a6b3a] hover:text-green-400 hover:border-green-700/40 disabled:opacity-40 transition-all">
          <Paperclip className="w-4 h-4" />
        </button>
        <textarea
          ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Задай вопрос о покере..." rows={1} disabled={loading}
          className="flex-1 bg-[#0d1d0d] border border-[#1a3a1a] rounded-xl px-4 py-2.5 text-sm text-green-100 placeholder-[#2d5a2d] resize-none focus:outline-none focus:border-green-700/50 transition-colors min-h-[40px] max-h-28"
          onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 112) + 'px' }}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()}
          className="flex-shrink-0 w-9 h-9 rounded-xl bg-green-800 hover:bg-green-700 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95">
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

// ── Training Tab ──────────────────────────────────────────────────────────────

const moduleColors = [
  { border: 'border-blue-500/20', text: 'text-blue-400', bar: 'bg-blue-500' },
  { border: 'border-purple-500/20', text: 'text-purple-400', bar: 'bg-purple-500' },
  { border: 'border-orange-500/20', text: 'text-orange-400', bar: 'bg-orange-500' },
  { border: 'border-emerald-500/20', text: 'text-emerald-400', bar: 'bg-emerald-500' },
]
const moduleIcons = ['📚', '🎯', '🔥', '💰']

function TrainingTab() {
  const [modules, setModules] = useState<ModuleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null)
  const [lessonContent, setLessonContent] = useState<LessonContent | null>(null)
  const [loadingLesson, setLoadingLesson] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    webAPI.getModules().then(r => setModules(r.data)).catch(() => setError('Не удалось загрузить модули')).finally(() => setLoading(false))
  }, [])

  const openLesson = async (id: string) => {
    setSelectedLesson(id); setLessonContent(null); setQuizAnswer(null); setLoadingLesson(true); setError('')
    try { const r = await webAPI.getLessonContent(id); setLessonContent(r.data.content) }
    catch (e: any) { setError(e?.response?.data?.detail || 'Не удалось загрузить урок') }
    finally { setLoadingLesson(false) }
  }

  const completeLesson = async () => {
    if (!selectedLesson) return
    setCompleting(true)
    try {
      await webAPI.completeLesson(selectedLesson)
      setModules(prev => prev.map(m => ({
        ...m,
        lessons: m.lessons.map(l => l.lesson_id === selectedLesson ? { ...l, completed: true } : l),
        completed_count: m.lessons.some(l => l.lesson_id === selectedLesson)
          ? m.completed_count + (m.lessons.find(l => l.lesson_id === selectedLesson)?.completed ? 0 : 1)
          : m.completed_count,
      })))
      setSelectedLesson(null); setLessonContent(null)
    } catch {} finally { setCompleting(false) }
  }

  const total = modules.reduce((s, m) => s + m.total_count, 0)
  const done = modules.reduce((s, m) => s + m.completed_count, 0)

  if (selectedLesson) return (
    <div>
      <button onClick={() => { setSelectedLesson(null); setLessonContent(null) }}
        className="flex items-center gap-1.5 text-[#4a8a4a] hover:text-green-300 transition-colors mb-5 text-sm">
        <ChevronLeft className="w-4 h-4" /> К модулям
      </button>

      {loadingLesson && (
        <div className="text-center py-16">
          <Loader className="w-7 h-7 text-amber-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#4a8a4a]">Генерирую урок...</p>
        </div>
      )}

      {error && !loadingLesson && (
        <div className="p-4 bg-red-950/30 border border-red-900/40 rounded-xl text-red-400 text-sm">{error}</div>
      )}

      {lessonContent && !loadingLesson && (
        <div className="space-y-4">
          <div className="bg-[#0d1d0d] border border-[#1a3a1a] rounded-2xl p-5">
            <h2 className="font-bold text-lg text-white mb-2">{lessonContent.title}</h2>
            <p className="text-sm text-[#4a8a4a] leading-relaxed">{lessonContent.introduction}</p>
          </div>

          <div className="bg-[#0d1d0d] border border-[#1a3a1a] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-blue-400">Теория</span>
            </div>
            <p className="text-sm text-green-200 leading-relaxed whitespace-pre-wrap">{lessonContent.theory}</p>
          </div>

          {lessonContent.key_concepts?.length > 0 && (
            <div className="bg-[#0d1d0d] border border-[#1a3a1a] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-amber-400">Ключевые концепции</span>
              </div>
              <ul className="space-y-2">
                {lessonContent.key_concepts.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-green-200">
                    <span className="text-amber-500 mt-0.5 flex-shrink-0">→</span>{c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {lessonContent.practical_tips?.length > 0 && (
            <div className="bg-[#0d1d0d] border border-[#1a3a1a] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400">Практические советы</span>
              </div>
              <ul className="space-y-2">
                {lessonContent.practical_tips.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-green-200">
                    <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>{t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {lessonContent.quiz_question && (
            <div className="bg-[#0d1d0d] border border-[#1a3a1a] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-amber-400">Квиз</span>
              </div>
              <p className="text-sm font-medium text-white mb-4">{lessonContent.quiz_question}</p>
              <div className="space-y-2">
                {lessonContent.quiz_options?.map((opt, i) => {
                  const letter = String.fromCharCode(65 + i)
                  const correct = letter === lessonContent.quiz_correct
                  const selected = quizAnswer === letter
                  const shown = quizAnswer !== null
                  return (
                    <button key={i} onClick={() => !quizAnswer && setQuizAnswer(letter)} disabled={!!quizAnswer}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                        shown && correct ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                        : shown && selected && !correct ? 'bg-red-950/40 border-red-500/40 text-red-400'
                        : !quizAnswer ? 'bg-[#1a3a1a] border-[#243f24] hover:border-green-700/50 text-green-200'
                        : 'bg-[#1a3a1a] border-[#1a3a1a] text-[#2d5a2d]'
                      }`}>
                      {opt}
                    </button>
                  )
                })}
              </div>
              {quizAnswer && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`mt-4 p-4 rounded-xl text-sm border ${
                    quizAnswer === lessonContent.quiz_correct
                      ? 'bg-emerald-950/30 border-emerald-900/40 text-emerald-400'
                      : 'bg-red-950/30 border-red-900/40 text-red-400'
                  }`}>
                  <p className="font-semibold mb-1">{quizAnswer === lessonContent.quiz_correct ? '✅ Правильно!' : '❌ Неверно'}</p>
                  <p className="text-green-200 text-sm">{lessonContent.quiz_explanation}</p>
                </motion.div>
              )}
            </div>
          )}

          <button onClick={completeLesson} disabled={completing}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-green-800 hover:bg-green-700 text-white disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
            {completing ? <><Loader className="w-4 h-4 animate-spin" />Сохраняю...</> : <><CheckCircle2 className="w-4 h-4" />Урок пройден</>}
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="bg-[#0d1d0d] border border-[#1a3a1a] rounded-xl px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#4a8a4a]">Прогресс</span>
          <span className="text-xs font-semibold text-amber-500">{done}/{total} уроков</span>
        </div>
        <div className="w-full bg-[#1a3a1a] rounded-full h-1.5">
          <motion.div className="bg-amber-500 h-1.5 rounded-full" initial={{ width: 0 }}
            animate={{ width: total > 0 ? `${(done / total) * 100}%` : '0%' }} transition={{ duration: 0.7 }} />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader className="w-7 h-7 text-amber-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#4a8a4a]">Загружаю модули...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-950/30 border border-red-900/40 rounded-xl text-red-400 text-sm">{error}</div>
      ) : (
        <div className="space-y-3">
          {modules.map((mod, idx) => {
            const c = moduleColors[idx] || moduleColors[0]
            const pct = mod.total_count > 0 ? (mod.completed_count / mod.total_count) * 100 : 0
            return (
              <motion.div key={mod.module_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.07 }}
                className={`bg-[#0d1d0d] border rounded-2xl overflow-hidden ${c.border}`}>
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{moduleIcons[idx]}</span>
                      <div>
                        <h3 className={`text-sm font-semibold ${c.text}`}>{mod.module_name}</h3>
                        <p className="text-xs text-[#2d5a2d]">{mod.completed_count}/{mod.total_count} уроков</p>
                      </div>
                    </div>
                    {mod.completed_count === mod.total_count && mod.total_count > 0 && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                  <div className="w-full bg-[#1a3a1a] rounded-full h-1">
                    <motion.div className={`h-1 rounded-full ${c.bar}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
                  </div>
                </div>
                <div className="border-t border-[#1a3a1a] divide-y divide-[#1a3a1a]">
                  {mod.lessons.map(lesson => (
                    <button key={lesson.lesson_id} onClick={() => openLesson(lesson.lesson_id)}
                      className="w-full flex items-center justify-between px-5 py-3 hover:bg-[#1a3a1a]/40 transition-colors text-left">
                      <div className="flex items-center gap-3">
                        {lesson.completed
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          : <Circle className="w-3.5 h-3.5 text-[#2d5a2d] flex-shrink-0" />}
                        <span className={`text-sm ${lesson.completed ? 'text-[#2d5a2d]' : 'text-green-200'}`}>{lesson.lesson_name}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-[#2d5a2d] flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'chat', label: 'AI Тренер', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'training', label: 'Обучение', icon: <BookOpen className="w-4 h-4" /> },
]

export default function AITrainer() {
  const [tab, setTab] = useState<Tab>('chat')
  const [dailyRemaining, setDailyRemaining] = useState(20)
  const [dailyLimit, setDailyLimit] = useState(20)
  const { user } = useAuth()

  useEffect(() => {
    webAPI.getProfile().then(r => {
      setDailyRemaining(r.data.daily_analyses_remaining ?? 20)
      setDailyLimit(r.data.daily_limit ?? 20)
    }).catch(() => {})
  }, [])

  const handleAnalyzed = () => setDailyRemaining(prev => Math.max(0, prev - 1))

  return (
    <div className="p-5 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">AI Тренер</h1>
        <p className="text-sm text-[#4a8a4a]">Задавай любые вопросы о покере</p>
      </div>

      <div className="flex bg-[#0d1d0d] border border-[#1a3a1a] rounded-xl p-1 mb-5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-[#1a3a1a] text-green-300 shadow'
                : 'text-[#3a6b3a] hover:text-green-300'
            }`}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tab === 'chat' && <ChatTab dailyRemaining={dailyRemaining} dailyLimit={dailyLimit} onAnalyzed={handleAnalyzed} />}
          {tab === 'training' && <TrainingTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
