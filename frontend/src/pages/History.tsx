import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  History as HistoryIcon,
  ChevronDown,
  ChevronUp,
  Loader,
  AlertCircle,
  FileText,
  Camera,
} from 'lucide-react'
import { webAPI, HandRecord, AnalysisResult } from '../api/client'

function ScoreBadge({ score }: { score: string | null | undefined }) {
  if (!score) return null
  const lower = score.toLowerCase()
  if (lower.includes('хорошо') || lower.includes('good')) {
    return <span className="badge-score-good text-xs">{score}</span>
  }
  if (lower.includes('удовлетворительно') || lower.includes('ok')) {
    return <span className="badge-score-ok text-xs">{score}</span>
  }
  return <span className="badge-score-bad text-xs">{score}</span>
}

function AnalysisDetail({ analysis }: { analysis: AnalysisResult }) {
  return (
    <div className="mt-4 space-y-3 pt-4 border-t border-poker-border">
      {analysis.preflop && (
        <div>
          <div className="text-xs font-semibold text-poker-text-muted uppercase tracking-wider mb-1">Префлоп</div>
          <p className="text-sm text-poker-text">{analysis.preflop}</p>
        </div>
      )}
      {analysis.flop && (
        <div>
          <div className="text-xs font-semibold text-poker-text-muted uppercase tracking-wider mb-1">Флоп</div>
          <p className="text-sm text-poker-text">{analysis.flop}</p>
        </div>
      )}
      {analysis.turn && (
        <div>
          <div className="text-xs font-semibold text-poker-text-muted uppercase tracking-wider mb-1">Тёрн</div>
          <p className="text-sm text-poker-text">{analysis.turn}</p>
        </div>
      )}
      {analysis.river && (
        <div>
          <div className="text-xs font-semibold text-poker-text-muted uppercase tracking-wider mb-1">Ривер</div>
          <p className="text-sm text-poker-text">{analysis.river}</p>
        </div>
      )}
      {analysis.main_leak && (
        <div>
          <div className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">Главная утечка</div>
          <p className="text-sm text-red-300 bg-poker-danger/10 border border-poker-danger/20 rounded-lg p-3">
            {analysis.main_leak}
          </p>
        </div>
      )}
      {analysis.recommended_line && (
        <div>
          <div className="text-xs font-semibold text-poker-success uppercase tracking-wider mb-1">Рекомендованная линия</div>
          <p className="text-sm text-poker-text bg-poker-success/10 border border-poker-success/20 rounded-lg p-3">
            {analysis.recommended_line}
          </p>
        </div>
      )}
      {analysis.ev_estimate && (
        <div>
          <div className="text-xs font-semibold text-poker-primary uppercase tracking-wider mb-1">Оценка EV</div>
          <p className="text-sm font-mono text-poker-text bg-poker-primary/10 border border-poker-primary/20 rounded-lg p-3">
            {analysis.ev_estimate}
          </p>
        </div>
      )}
    </div>
  )
}

function HandItem({ hand }: { hand: HandRecord }) {
  const [expanded, setExpanded] = useState(false)
  const isScreenshot = hand.hand_text_preview.startsWith('[Screenshot:')

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('ru', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card hover:border-poker-accent transition-all duration-200"
    >
      <div
        className="flex items-start justify-between gap-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-8 h-8 bg-poker-secondary rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
            {isScreenshot ? (
              <Camera className="w-4 h-4 text-blue-400" />
            ) : (
              <FileText className="w-4 h-4 text-poker-primary" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <ScoreBadge score={hand.analysis?.overall_score} />
              <span className="text-xs text-poker-text-muted">{formatDate(hand.created_at)}</span>
            </div>
            <p className="text-sm text-poker-text-muted font-mono truncate">
              {hand.hand_text_preview}
            </p>
            {hand.analysis?.main_leak && !expanded && (
              <p className="text-xs text-poker-text-muted mt-1 truncate opacity-70">
                ↳ {hand.analysis.main_leak.slice(0, 80)}...
              </p>
            )}
          </div>
        </div>

        <button className="text-poker-text-muted hover:text-poker-text transition-colors flex-shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && hand.analysis && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <AnalysisDetail analysis={hand.analysis as AnalysisResult} />
          </motion.div>
        )}
        {expanded && !hand.analysis && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-poker-border"
          >
            <p className="text-poker-text-muted text-sm">Анализ недоступен</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function History() {
  const [hands, setHands] = useState<HandRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const resp = await webAPI.getHistory()
      setHands(resp.data)
    } catch {
      setError('Не удалось загрузить историю')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">История раздач</h1>
            <p className="text-poker-text-muted text-sm mt-0.5">Последние 20 проанализированных раздач</p>
          </div>
          {hands.length > 0 && (
            <div className="text-sm text-poker-text-muted">
              {hands.length} раздач
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16">
            <Loader className="w-8 h-8 text-poker-primary animate-spin mx-auto mb-3" />
            <p className="text-poker-text-muted">Загружаю историю...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-poker-danger/10 border border-poker-danger/30 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : hands.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="w-16 h-16 bg-poker-secondary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <HistoryIcon className="w-8 h-8 text-poker-text-muted" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Нет раздач</h3>
            <p className="text-poker-text-muted text-sm">
              Ещё не было проанализировано ни одной раздачи.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {hands.map((hand, i) => (
              <HandItem key={hand.hand_id} hand={hand} />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
