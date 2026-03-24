import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Plus, Trash2, Brain, ChevronDown, ChevronUp,
  AlertCircle, Loader, MessageSquare, X
} from 'lucide-react'
import { webAPI, Opponent, OpponentAnalysis } from '../api/client'

function ThreatBadge({ threat }: { threat?: string }) {
  if (!threat) return null
  const lower = threat.toLowerCase()
  if (lower.includes('опасн')) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">{threat}</span>
  if (lower.includes('слаб')) return <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">{threat}</span>
  return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">{threat}</span>
}

function AnalysisView({ analysis }: { analysis: OpponentAnalysis }) {
  return (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-poker-secondary/60 rounded-lg p-3 text-center">
          <div className="text-xs text-poker-text-muted mb-1">Стиль</div>
          <div className="font-bold text-poker-primary">{analysis.play_style}</div>
        </div>
        <div className="bg-poker-secondary/60 rounded-lg p-3 text-center">
          <div className="text-xs text-poker-text-muted mb-1">VPIP</div>
          <div className="font-bold">{analysis.vpip_estimate}%</div>
        </div>
        <div className="bg-poker-secondary/60 rounded-lg p-3 text-center">
          <div className="text-xs text-poker-text-muted mb-1">Агрессия</div>
          <div className="font-bold">{analysis.aggression}</div>
        </div>
      </div>

      {analysis.tendencies?.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-poker-text-muted uppercase tracking-wider mb-1.5">Тенденции</div>
          <ul className="space-y-1">
            {analysis.tendencies.map((t, i) => (
              <li key={i} className="text-sm text-poker-text flex items-start gap-2">
                <span className="text-poker-primary mt-0.5">•</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.weaknesses?.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1.5">Слабости</div>
          <ul className="space-y-1">
            {analysis.weaknesses.map((w, i) => (
              <li key={i} className="text-sm text-poker-text flex items-start gap-2">
                <span className="text-red-400 mt-0.5">✗</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.how_to_exploit && (
        <div className="bg-poker-success/10 border border-poker-success/20 rounded-lg p-3">
          <div className="text-xs font-semibold text-poker-success uppercase tracking-wider mb-1">Как эксплойтить</div>
          <p className="text-sm text-poker-text">{analysis.how_to_exploit}</p>
        </div>
      )}
    </div>
  )
}

function OpponentCard({
  opponent,
  onDelete,
  onAddNote,
  onAnalyze,
}: {
  opponent: Opponent
  onDelete: (id: number) => void
  onAddNote: (id: number, note: string) => Promise<void>
  onAnalyze: (id: number) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [analyzingLocal, setAnalyzingLocal] = useState(false)
  const [addingNote, setAddingNote] = useState(false)

  const handleAddNote = async () => {
    if (!noteText.trim()) return
    setAddingNote(true)
    await onAddNote(opponent.id, noteText.trim())
    setNoteText('')
    setShowNoteForm(false)
    setAddingNote(false)
  }

  const handleAnalyze = async () => {
    setAnalyzingLocal(true)
    await onAnalyze(opponent.id)
    setAnalyzingLocal(false)
    setExpanded(true)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-poker-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-poker-primary">{opponent.nickname.charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <div className="font-semibold flex items-center gap-2 flex-wrap">
              {opponent.nickname}
              {opponent.analysis && <ThreatBadge threat={opponent.analysis.overall_threat} />}
            </div>
            <div className="text-xs text-poker-text-muted">
              {opponent.hands_count} {opponent.hands_count === 1 ? 'заметка' : opponent.hands_count < 5 ? 'заметки' : 'заметок'}
              {opponent.analysis && ` · ${opponent.analysis.play_style}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setShowNoteForm(!showNoteForm)}
            className="p-2 rounded-lg text-poker-text-muted hover:text-poker-primary hover:bg-poker-primary/10 transition-colors"
            title="Добавить заметку"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button
            onClick={handleAnalyze}
            disabled={analyzingLocal || opponent.hands_count === 0}
            className="p-2 rounded-lg text-poker-text-muted hover:text-poker-accent hover:bg-poker-accent/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Запустить AI анализ"
          >
            {analyzingLocal ? <Loader className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onDelete(opponent.id)}
            className="p-2 rounded-lg text-poker-text-muted hover:text-poker-danger hover:bg-poker-danger/10 transition-colors"
            title="Удалить"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {opponent.analysis && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 rounded-lg text-poker-text-muted hover:text-poker-text transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Note form */}
      <AnimatePresence>
        {showNoteForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden"
          >
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Опиши раздачу против него: позиция, действия, результат..."
              className="input-field text-sm resize-none h-24"
              disabled={addingNote}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleAddNote}
                disabled={addingNote || !noteText.trim()}
                className="btn-primary text-sm py-1.5 flex items-center gap-1 disabled:opacity-50"
              >
                {addingNote ? <Loader className="w-3 h-3 animate-spin" /> : null}
                Сохранить
              </button>
              <button
                onClick={() => { setShowNoteForm(false); setNoteText('') }}
                className="text-sm text-poker-text-muted hover:text-poker-text px-3 py-1.5 rounded-lg hover:bg-poker-secondary transition-colors"
              >
                Отмена
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes list */}
      {expanded && opponent.notes.length > 0 && (
        <div className="mt-3 pt-3 border-t border-poker-border">
          <div className="text-xs font-semibold text-poker-text-muted uppercase tracking-wider mb-2">
            Заметки ({opponent.notes.length})
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {opponent.notes.map((note, i) => (
              <div key={i} className="text-xs text-poker-text bg-poker-secondary/40 rounded p-2">
                <span className="text-poker-text-muted mr-1">#{i + 1}</span>{note}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Analysis */}
      <AnimatePresence>
        {expanded && opponent.analysis && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-poker-border overflow-hidden"
          >
            <AnalysisView analysis={opponent.analysis} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function Opponents() {
  const [opponents, setOpponents] = useState<Opponent[]>([])
  const [loading, setLoading] = useState(true)
  const [newNickname, setNewNickname] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    webAPI.listOpponents().then((r) => {
      setOpponents(r.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    const nick = newNickname.trim()
    if (!nick) return
    setCreating(true)
    setError('')
    try {
      const r = await webAPI.createOpponent(nick)
      setOpponents((prev) => [r.data, ...prev])
      setNewNickname('')
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Ошибка создания')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: number) => {
    await webAPI.deleteOpponent(id)
    setOpponents((prev) => prev.filter((o) => o.id !== id))
  }

  const handleAddNote = async (id: number, note: string) => {
    const r = await webAPI.addOpponentNote(id, note)
    setOpponents((prev) => prev.map((o) => (o.id === id ? r.data : o)))
  }

  const handleAnalyze = async (id: number) => {
    try {
      const r = await webAPI.analyzeOpponent(id)
      setOpponents((prev) => prev.map((o) => (o.id === id ? r.data : o)))
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Ошибка анализа')
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-6 h-6 text-poker-primary" />
          <h1 className="text-2xl font-bold">Оппоненты</h1>
        </div>
        <p className="text-poker-text-muted mb-6">
          Собирай заметки по каждому оппоненту — AI определит стиль игры и как его эксплойтить
        </p>

        {/* Create new opponent */}
        <div className="card mb-6">
          <h2 className="font-semibold mb-3">Добавить оппонента</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Никнейм оппонента"
              className="input-field flex-1"
              disabled={creating}
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newNickname.trim()}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {creating ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Добавить
            </button>
          </div>
          <p className="text-xs text-poker-text-muted mt-2">
            После добавления: записывай заметки о руках → нажми Brain для AI анализа стиля игры
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-poker-danger/10 border border-poker-danger/30 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={() => setError('')} className="ml-auto text-poker-text-muted hover:text-poker-text">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-6 h-6 animate-spin text-poker-primary" />
          </div>
        ) : opponents.length === 0 ? (
          <div className="text-center py-12 text-poker-text-muted">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Нет сохранённых оппонентов</p>
            <p className="text-sm mt-1">Добавь первого оппонента выше</p>
          </div>
        ) : (
          <div className="space-y-3">
            {opponents.map((opp) => (
              <OpponentCard
                key={opp.id}
                opponent={opp}
                onDelete={handleDelete}
                onAddNote={handleAddNote}
                onAnalyze={handleAnalyze}
              />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
