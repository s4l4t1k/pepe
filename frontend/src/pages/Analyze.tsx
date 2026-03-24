import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Camera, Upload, X, Loader, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { webAPI, AnalysisResult } from '../api/client'

const POKER_TIPS = [
  "Позиция решает: BTN открывает 45–50% рук в 6-max",
  "C-bet на сухом борде T72r ~65–70%, на влажном A♥J♥T♥ ~40%",
  "Флаш-дро = 9 аутов = ~35% на флопе",
  "3-бет IP: против BTN открытия 3-бети 9–12% рук",
  "Банкролл: минимум 20 байинов для стабильной игры",
  "GTO ривер: блефуй в пропорции 1:2 к вэлью при пот-сайзинге",
  "Mental game: EV, а не результат — вот что оцениваем",
  "Защита BB: защищай 40–45% против стила с BTN",
  "IP = +2–3 bb/100 над OOP при прочих равных",
  "Овербет: поляризованный рейндж → 120–150% пота на ривере",
]

type Tab = 'text' | 'screenshot'

function ScoreBadge({ score }: { score: string | null }) {
  if (!score) return null
  const lower = score.toLowerCase()
  if (lower.includes('хорошо') || lower.includes('good')) {
    return <span className="badge-score-good">{score}</span>
  }
  if (lower.includes('удовлетворительно') || lower.includes('ok')) {
    return <span className="badge-score-ok">{score}</span>
  }
  return <span className="badge-score-bad">{score}</span>
}

function AnalysisSection({ label, content }: { label: string; content: string }) {
  if (!content) return null
  return (
    <div className="mb-4">
      <div className="text-xs font-semibold text-poker-text-muted uppercase tracking-wider mb-1.5">{label}</div>
      <div className="text-sm text-poker-text leading-relaxed bg-poker-secondary/50 rounded-lg p-3 border border-poker-border">
        {content}
      </div>
    </div>
  )
}

function AnalysisCard({ analysis }: { analysis: AnalysisResult }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card mt-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-lg">Анализ</h3>
          <ScoreBadge score={analysis.overall_score ?? null} />
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-poker-text-muted hover:text-poker-text transition-colors"
        >
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <AnalysisSection label="Префлоп" content={analysis.preflop} />
            <AnalysisSection label="Флоп" content={analysis.flop} />
            <AnalysisSection label="Тёрн" content={analysis.turn} />
            <AnalysisSection label="Ривер" content={analysis.river} />

            {analysis.main_leak && (
              <div className="mb-4">
                <div className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1.5">Главная утечка</div>
                <div className="text-sm text-poker-text leading-relaxed bg-poker-danger/10 border border-poker-danger/20 rounded-lg p-3">
                  {analysis.main_leak}
                </div>
              </div>
            )}

            {analysis.recommended_line && (
              <div className="mb-4">
                <div className="text-xs font-semibold text-poker-success uppercase tracking-wider mb-1.5">Рекомендованная линия</div>
                <div className="text-sm text-poker-text leading-relaxed bg-poker-success/10 border border-poker-success/20 rounded-lg p-3">
                  {analysis.recommended_line}
                </div>
              </div>
            )}

            {analysis.ev_estimate && (
              <div className="mb-4">
                <div className="text-xs font-semibold text-poker-primary uppercase tracking-wider mb-1.5">Оценка EV</div>
                <div className="text-sm text-poker-text font-mono bg-poker-primary/10 border border-poker-primary/20 rounded-lg p-3">
                  {analysis.ev_estimate}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function Analyze() {
  const [activeTab, setActiveTab] = useState<Tab>('text')
  const [handText, setHandText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tipIndex, setTipIndex] = useState(0)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const tipIntervalRef = useRef<number | null>(null)

  const startTipRotation = () => {
    tipIntervalRef.current = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % POKER_TIPS.length)
    }, 3000)
  }

  const stopTipRotation = () => {
    if (tipIntervalRef.current) {
      clearInterval(tipIntervalRef.current)
      tipIntervalRef.current = null
    }
  }

  const handleAnalyzeText = async () => {
    if (!handText.trim()) return
    setLoading(true)
    setError('')
    setAnalysis(null)
    startTipRotation()

    try {
      const resp = await webAPI.analyzeHand(handText)
      setAnalysis(resp.data.analysis)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Ошибка анализа. Попробуй ещё раз.')
    } finally {
      setLoading(false)
      stopTipRotation()
    }
  }

  const handleAnalyzeScreenshot = async () => {
    if (!imageFile) return
    setLoading(true)
    setError('')
    setAnalysis(null)
    startTipRotation()

    try {
      const resp = await webAPI.analyzeScreenshot(imageFile)
      setAnalysis(resp.data.analysis)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Ошибка анализа скриншота.')
    } finally {
      setLoading(false)
      stopTipRotation()
    }
  }

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      setImageFile(file)
      const url = URL.createObjectURL(file)
      setImagePreview(url)
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const url = URL.createObjectURL(file)
      setImagePreview(url)
    }
  }

  const clearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold mb-2">Анализ раздачи</h1>
        <p className="text-poker-text-muted mb-6">
          Отправь текст раздачи или скриншот — AI разберёт каждую улицу
        </p>

        {/* Tabs */}
        <div className="flex bg-poker-secondary rounded-xl p-1 mb-6">
          {(['text', 'screenshot'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setAnalysis(null); setError('') }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-poker-primary text-poker-bg shadow-md'
                  : 'text-poker-text-muted hover:text-poker-text'
              }`}
            >
              {tab === 'text' ? <FileText className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
              {tab === 'text' ? 'Текст раздачи' : 'Скриншот'}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'text' ? (
            <motion.div
              key="text"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <textarea
                value={handText}
                onChange={(e) => setHandText(e.target.value)}
                placeholder={`Вставь текст раздачи в любом формате:\n\nPokerStars Hand #123...\nHero: AsKh\nBTN raises to 3bb...\n\nили\n\nПозиция: BTN, стек 100bb\nКарты: AK\nОпонент рейзит до 3bb...`}
                className="input-field h-56 resize-none font-mono text-sm"
                disabled={loading}
              />
              <p className="text-xs text-poker-text-muted mt-2">
                Поддерживаются: PokerStars hand history, GGPoker, или свободное описание с картами и действиями. Для вопросов без конкретной раздачи — используй <strong>AI Тренер</strong>.
              </p>
              <button
                onClick={handleAnalyzeText}
                disabled={loading || !handText.trim()}
                className="btn-primary w-full mt-3 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Анализирую...
                  </>
                ) : (
                  'Анализировать раздачу'
                )}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="screenshot"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {!imagePreview ? (
                <div
                  onDrop={handleFileDrop}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl h-56 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                    dragOver
                      ? 'border-poker-primary bg-poker-primary/10'
                      : 'border-poker-border hover:border-poker-accent bg-poker-secondary/30'
                  }`}
                >
                  <Upload className={`w-10 h-10 mb-3 ${dragOver ? 'text-poker-primary' : 'text-poker-text-muted'}`} />
                  <p className="font-medium text-poker-text">Перетащи скриншот сюда</p>
                  <p className="text-poker-text-muted text-sm mt-1">или нажми для выбора файла</p>
                  <p className="text-poker-text-muted text-xs mt-2">JPEG, PNG, WebP до 10 МБ</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Скриншот"
                    className="w-full max-h-64 object-contain rounded-xl border border-poker-border bg-poker-secondary"
                  />
                  <button
                    onClick={clearImage}
                    className="absolute top-2 right-2 w-7 h-7 bg-poker-bg/90 rounded-full flex items-center justify-center text-poker-text-muted hover:text-poker-danger transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <button
                onClick={handleAnalyzeScreenshot}
                disabled={loading || !imageFile}
                className="btn-primary w-full mt-4 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Анализирую скриншот...
                  </>
                ) : (
                  'Анализировать скриншот'
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading tip */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 p-4 bg-poker-secondary border border-poker-border rounded-xl"
            >
              <div className="flex items-center gap-2 mb-2">
                <Loader className="w-4 h-4 text-poker-primary animate-spin" />
                <span className="text-sm font-medium text-poker-primary">AI анализирует...</span>
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={tipIndex}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.3 }}
                  className="text-poker-text-muted text-sm"
                >
                  💡 {POKER_TIPS[tipIndex]}
                </motion.p>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-poker-danger/10 border border-poker-danger/30 rounded-xl flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{error}</p>
          </motion.div>
        )}

        {/* Analysis result */}
        {analysis && <AnalysisCard analysis={analysis} />}
      </motion.div>
    </div>
  )
}
