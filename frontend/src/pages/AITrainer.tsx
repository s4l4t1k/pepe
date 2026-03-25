import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Camera, Upload, X, Loader, ChevronDown, ChevronUp,
  AlertCircle, Send, Trash2, Spade, User as UserIcon,
  BookOpen, CheckCircle2, Circle, ChevronRight, ChevronLeft,
  Trophy, Lightbulb, Target, Brain, Zap,
} from 'lucide-react'
import { webAPI, AnalysisResult, ModuleItem, LessonContent } from '../api/client'
import { useAuth } from '../store/auth'

type Tab = 'analyze' | 'training' | 'chat'
type AnalyzeInput = 'text' | 'screenshot'

// ── Shared ────────────────────────────────────────────────────────────────────

const POKER_TIPS = [
  "Позиция решает: BTN открывает 45–50% рук в 6-max",
  "C-bet на сухом борде T72r ~65–70%, на влажном A♥J♥T♥ ~40%",
  "Флаш-дро = 9 аутов = ~35% на флопе",
  "3-бет IP: против BTN открытия 3-бети 9–12% рук",
  "GTO ривер: блефуй в пропорции 1:2 к вэлью при пот-сайзинге",
  "Защита BB: защищай 40–45% против стила с BTN",
  "Овербет: поляризованный рейндж → 120–150% пота на ривере",
]

// ── Analyze Tab ───────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: string | null }) {
  if (!score) return null
  const lower = score.toLowerCase()
  if (lower.includes('хорошо') || lower.includes('good'))
    return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">{score}</span>
  if (lower.includes('удовлетворительно') || lower.includes('ok'))
    return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">{score}</span>
  return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-500/15 text-red-400 border border-red-500/25">{score}</span>
}

function AnalysisField({ label, content, accent }: { label: string; content: string; accent?: string }) {
  if (!content) return null
  return (
    <div className="mb-3">
      <div className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${accent || 'text-zinc-500'}`}>{label}</div>
      <div className="text-sm text-zinc-200 leading-relaxed bg-zinc-900/60 rounded-lg px-3.5 py-2.5 border border-zinc-800">
        {content}
      </div>
    </div>
  )
}

function AnalysisCard({ analysis }: { analysis: AnalysisResult }) {
  const [expanded, setExpanded] = useState(true)
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-5 bg-zinc-900 border border-zinc-800 rounded-2xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-zinc-100">Разбор</span>
          <ScoreBadge score={analysis.overall_score ?? null} />
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-zinc-600 hover:text-zinc-400 transition-colors">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
          >
            <AnalysisField label="Префлоп" content={analysis.preflop} />
            <AnalysisField label="Флоп" content={analysis.flop} />
            <AnalysisField label="Тёрн" content={analysis.turn} />
            <AnalysisField label="Ривер" content={analysis.river} />
            {analysis.main_leak && (
              <div className="mb-3">
                <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5 text-red-400">Главная утечка</div>
                <div className="text-sm text-zinc-200 leading-relaxed bg-red-950/30 rounded-lg px-3.5 py-2.5 border border-red-900/40">{analysis.main_leak}</div>
              </div>
            )}
            {analysis.recommended_line && (
              <div className="mb-3">
                <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5 text-emerald-400">Рекомендованная линия</div>
                <div className="text-sm text-zinc-200 leading-relaxed bg-emerald-950/30 rounded-lg px-3.5 py-2.5 border border-emerald-900/40">{analysis.recommended_line}</div>
              </div>
            )}
            {analysis.ev_estimate && (
              <div className="mb-3">
                <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5 text-amber-400">EV оценка</div>
                <div className="text-sm font-mono text-zinc-200 leading-relaxed bg-amber-950/20 rounded-lg px-3.5 py-2.5 border border-amber-900/30">{analysis.ev_estimate}</div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function AnalyzeTab({ dailyRemaining, dailyLimit, onAnalyzed }: {
  dailyRemaining: number
  dailyLimit: number
  onAnalyzed: () => void
}) {
  const [inputType, setInputType] = useState<AnalyzeInput>('text')
  const [handText, setHandText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tipIndex, setTipIndex] = useState(0)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const tipRef = useRef<number | null>(null)

  const startTips = () => {
    tipRef.current = window.setInterval(() => setTipIndex(i => (i + 1) % POKER_TIPS.length), 3000)
  }
  const stopTips = () => { if (tipRef.current) { clearInterval(tipRef.current); tipRef.current = null } }

  const handleText = async () => {
    if (!handText.trim()) return
    setLoading(true); setError(''); setAnalysis(null); startTips()
    try {
      const resp = await webAPI.analyzeHand(handText)
      setAnalysis(resp.data.analysis)
      onAnalyzed()
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Ошибка анализа. Попробуй ещё раз.')
    } finally { setLoading(false); stopTips() }
  }

  const handleScreenshot = async () => {
    if (!imageFile) return
    setLoading(true); setError(''); setAnalysis(null); startTips()
    try {
      const resp = await webAPI.analyzeScreenshot(imageFile)
      setAnalysis(resp.data.analysis)
      onAnalyzed()
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Ошибка анализа скриншота.')
    } finally { setLoading(false); stopTips() }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('image/')) { setImageFile(file); setImagePreview(URL.createObjectURL(file)) }
  }, [])

  const clearImage = () => { setImageFile(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = '' }

  const limitColor = dailyRemaining <= 3 ? 'text-red-400' : dailyRemaining <= 7 ? 'text-amber-400' : 'text-emerald-400'

  return (
    <div className="space-y-4">
      {/* Limit bar */}
      <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5">
        <span className="text-xs text-zinc-500">Анализов сегодня</span>
        <span className={`text-xs font-semibold ${limitColor}`}>
          {dailyRemaining} / {dailyLimit} осталось
        </span>
      </div>

      {/* Input toggle */}
      <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1">
        {(['text', 'screenshot'] as AnalyzeInput[]).map(t => (
          <button
            key={t}
            onClick={() => { setInputType(t); setAnalysis(null); setError('') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              inputType === t ? 'bg-amber-500 text-zinc-900' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t === 'text' ? <FileText className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
            {t === 'text' ? 'Текст раздачи' : 'Скриншот'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {inputType === 'text' ? (
          <motion.div key="text" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
            <textarea
              value={handText}
              onChange={e => setHandText(e.target.value)}
              placeholder={"Вставь текст раздачи в любом формате:\n\nPokerStars Hand #123...\nHero: AsKh\nBTN raises to 3bb...\n\nили описание раздачи своими словами"}
              className="w-full h-44 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 font-mono resize-none focus:outline-none focus:border-amber-500/50 transition-colors"
              disabled={loading}
            />
            <button
              onClick={handleText}
              disabled={loading || !handText.trim() || dailyRemaining === 0}
              className="w-full mt-3 py-3 rounded-xl font-semibold text-sm transition-all bg-amber-500 hover:bg-amber-400 text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <><Loader className="w-4 h-4 animate-spin" />Анализирую...</> : 'Анализировать'}
            </button>
          </motion.div>
        ) : (
          <motion.div key="screenshot" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
            {!imagePreview ? (
              <div
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`h-44 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${
                  dragOver ? 'border-amber-500 bg-amber-500/5' : 'border-zinc-800 hover:border-zinc-600 bg-zinc-900'
                }`}
              >
                <Upload className={`w-8 h-8 mb-2 ${dragOver ? 'text-amber-500' : 'text-zinc-600'}`} />
                <p className="text-sm text-zinc-400">Перетащи скриншот или нажми</p>
                <p className="text-xs text-zinc-600 mt-1">JPEG, PNG, WebP до 10 МБ</p>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)) }
                }} className="hidden" />
              </div>
            ) : (
              <div className="relative">
                <img src={imagePreview} alt="Скриншот" className="w-full max-h-56 object-contain rounded-xl border border-zinc-800 bg-zinc-900" />
                <button onClick={clearImage} className="absolute top-2 right-2 w-7 h-7 bg-zinc-900/90 rounded-full flex items-center justify-center text-zinc-400 hover:text-red-400 transition-colors border border-zinc-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <button
              onClick={handleScreenshot}
              disabled={loading || !imageFile || dailyRemaining === 0}
              className="w-full mt-3 py-3 rounded-xl font-semibold text-sm transition-all bg-amber-500 hover:bg-amber-400 text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <><Loader className="w-4 h-4 animate-spin" />Анализирую...</> : 'Анализировать скриншот'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading tip */}
      <AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-amber-500 animate-pulse" />
              <span className="text-xs font-medium text-amber-500">AI анализирует...</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.p key={tipIndex} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="text-xs text-zinc-500">
                💡 {POKER_TIPS[tipIndex]}
              </motion.p>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 bg-red-950/30 border border-red-900/40 rounded-xl p-4">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </motion.div>
      )}

      {analysis && <AnalysisCard analysis={analysis} />}
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
        className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors mb-5 text-sm">
        <ChevronLeft className="w-4 h-4" /> К модулям
      </button>

      {loadingLesson && (
        <div className="text-center py-16">
          <Loader className="w-7 h-7 text-amber-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Генерирую урок...</p>
        </div>
      )}

      {error && !loadingLesson && (
        <div className="p-4 bg-red-950/30 border border-red-900/40 rounded-xl text-red-400 text-sm">{error}</div>
      )}

      {lessonContent && !loadingLesson && (
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h2 className="font-bold text-lg text-zinc-100 mb-2">{lessonContent.title}</h2>
            <p className="text-sm text-zinc-400 leading-relaxed">{lessonContent.introduction}</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-blue-400">Теория</span>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{lessonContent.theory}</p>
          </div>

          {lessonContent.key_concepts?.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-amber-400">Ключевые концепции</span>
              </div>
              <ul className="space-y-2">
                {lessonContent.key_concepts.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <span className="text-amber-500 mt-0.5 flex-shrink-0">→</span>{c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {lessonContent.practical_tips?.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400">Практические советы</span>
              </div>
              <ul className="space-y-2">
                {lessonContent.practical_tips.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>{t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {lessonContent.quiz_question && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-amber-400">Квиз</span>
              </div>
              <p className="text-sm font-medium text-zinc-200 mb-4">{lessonContent.quiz_question}</p>
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
                        : !quizAnswer ? 'bg-zinc-800 border-zinc-700 hover:border-amber-500/50 text-zinc-300'
                        : 'bg-zinc-800 border-zinc-800 text-zinc-600'
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
                  <p className="text-zinc-300 text-sm">{lessonContent.quiz_explanation}</p>
                </motion.div>
              )}
            </div>
          )}

          <button onClick={completeLesson} disabled={completing}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-amber-500 hover:bg-amber-400 text-zinc-900 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
            {completing ? <><Loader className="w-4 h-4 animate-spin" />Сохраняю...</> : <><CheckCircle2 className="w-4 h-4" />Урок пройден</>}
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-500">Прогресс</span>
          <span className="text-xs font-semibold text-amber-500">{done}/{total} уроков</span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-1.5">
          <motion.div className="bg-amber-500 h-1.5 rounded-full" initial={{ width: 0 }}
            animate={{ width: total > 0 ? `${(done / total) * 100}%` : '0%' }} transition={{ duration: 0.7 }} />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader className="w-7 h-7 text-amber-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Загружаю модули...</p>
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
                className={`bg-zinc-900 border rounded-2xl overflow-hidden ${c.border}`}>
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{moduleIcons[idx]}</span>
                      <div>
                        <h3 className={`text-sm font-semibold ${c.text}`}>{mod.module_name}</h3>
                        <p className="text-xs text-zinc-600">{mod.completed_count}/{mod.total_count} уроков</p>
                      </div>
                    </div>
                    {mod.completed_count === mod.total_count && mod.total_count > 0 && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1">
                    <motion.div className={`h-1 rounded-full ${c.bar}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
                  </div>
                </div>
                <div className="border-t border-zinc-800 divide-y divide-zinc-800/60">
                  {mod.lessons.map(lesson => (
                    <button key={lesson.lesson_id} onClick={() => openLesson(lesson.lesson_id)}
                      className="w-full flex items-center justify-between px-5 py-3 hover:bg-zinc-800/40 transition-colors text-left">
                      <div className="flex items-center gap-3">
                        {lesson.completed
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          : <Circle className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />}
                        <span className={`text-sm ${lesson.completed ? 'text-zinc-600' : 'text-zinc-300'}`}>{lesson.lesson_name}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
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

// ── Chat Tab ──────────────────────────────────────────────────────────────────

interface Message { role: 'user' | 'assistant'; content: string; timestamp: Date }

const SUGGESTED = [
  'Как правильно защищать BB против стила?',
  'Когда делать overshove со стеком 15bb?',
  'Объясни GTO блефинг на ривере',
  'Как читать текстуру борда?',
  'VPIP/PFR — какие значения оптимальны для TAG?',
]

function ChatTab() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async (q?: string) => {
    const text = q || input.trim()
    if (!text || loading) return
    const userMsg: Message = { role: 'user', content: text, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg]); setInput(''); setLoading(true)
    const history = messages.map(m => ({ role: m.role, content: m.content }))
    try {
      const resp = await webAPI.askAssistant(text, history)
      setMessages(prev => [...prev, { role: 'assistant', content: resp.data.answer, timestamp: new Date() }])
    } catch (e: any) {
      const detail = e?.response?.data?.detail || 'Не удалось получить ответ'
      setMessages(prev => [...prev, { role: 'assistant', content: `Ошибка: ${detail}`, timestamp: new Date() }])
    } finally { setLoading(false); inputRef.current?.focus() }
  }

  const fmt = (d: Date) => d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 220px)', minHeight: 400 }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="py-4">
            <div className="w-12 h-12 bg-amber-500/15 rounded-2xl flex items-center justify-center mb-4">
              <Spade className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="font-semibold text-zinc-100 mb-1">Привет, {user?.first_name}!</h3>
            <p className="text-sm text-zinc-500 mb-5 max-w-xs">Задавай любые вопросы о покере — отвечу с числами и диапазонами.</p>
            <div className="space-y-2 max-w-sm">
              {SUGGESTED.map((q, i) => (
                <motion.button key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                  onClick={() => send(q)}
                  className="w-full text-left text-sm px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-amber-500/40 hover:bg-amber-500/5 transition-all text-zinc-400">
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
                <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${
                  msg.role === 'assistant' ? 'bg-amber-500/15 border border-amber-500/25' : 'bg-zinc-800 border border-zinc-700'
                }`}>
                  {msg.role === 'assistant' ? <Spade className="w-3.5 h-3.5 text-amber-500" /> : <UserIcon className="w-3.5 h-3.5 text-zinc-400" />}
                </div>
                <div className={`max-w-[80%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user' ? 'bg-amber-500 text-zinc-900 rounded-tr-sm' : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-sm'
                  }`}>
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-zinc-600 px-1">{msg.role === 'assistant' ? 'Виктор' : user?.first_name} · {fmt(msg.timestamp)}</span>
                </div>
              </motion.div>
            ))}
            {loading && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                  <Spade className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-2xl rounded-tl-sm">
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
      <div className="mt-3 flex gap-2 items-end border-t border-zinc-800 pt-3">
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} className="flex-shrink-0 w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 hover:text-red-400 hover:border-red-900 transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        <textarea
          ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Задай вопрос о покере..." rows={1} disabled={loading}
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-amber-500/50 transition-colors min-h-[40px] max-h-28"
          onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 112) + 'px' }}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()}
          className="flex-shrink-0 w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-900 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95">
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'analyze', label: 'Анализ', icon: <Zap className="w-4 h-4" /> },
  { id: 'training', label: 'Обучение', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'chat', label: 'Чат', icon: <Spade className="w-4 h-4" /> },
]

export default function AITrainer() {
  const [tab, setTab] = useState<Tab>('analyze')
  const [dailyRemaining, setDailyRemaining] = useState(20)
  const [dailyLimit, setDailyLimit] = useState(20)
  const { user } = useAuth()

  useEffect(() => {
    webAPI.getProfile().then(r => {
      setDailyRemaining(r.data.daily_analyses_remaining ?? 20)
      setDailyLimit(r.data.daily_limit ?? 20)
    }).catch(() => {})
  }, [])

  const handleAnalyzed = () => {
    setDailyRemaining(prev => Math.max(0, prev - 1))
  }

  return (
    <div className="p-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-zinc-100">AI Тренер</h1>
        <p className="text-sm text-zinc-500">Привет, {user?.first_name}</p>
      </div>

      {/* Tab bar */}
      <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 mb-5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'bg-zinc-800 text-zinc-100 shadow' : 'text-zinc-500 hover:text-zinc-300'
            }`}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tab === 'analyze' && <AnalyzeTab dailyRemaining={dailyRemaining} dailyLimit={dailyLimit} onAnalyzed={handleAnalyzed} />}
          {tab === 'training' && <TrainingTab />}
          {tab === 'chat' && <ChatTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
