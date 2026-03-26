import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shuffle, ChevronRight, Loader, CheckCircle2, XCircle, RefreshCw, Swords, Brain } from 'lucide-react'
import client from '../api/client'

// ── Card types & helpers ───────────────────────────────────────────────────────

interface Card { rank: string; suit: 's' | 'h' | 'd' | 'c' }

const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A']
const SUITS: Array<'s'|'h'|'d'|'c'> = ['s','h','d','c']
const SUIT_SYM = { s:'♠', h:'♥', d:'♦', c:'♣' }
const SUIT_COLOR = { s:'#e2e8f0', h:'#f87171', d:'#f87171', c:'#e2e8f0' }
const POSITIONS = ['UTG','HJ','CO','BTN','SB','BB']
const STREETS = ['preflop','flop','turn','river'] as const
type Street = typeof STREETS[number]

function parseCard(s: string): Card {
  // e.g. "Ah" → {rank:'A', suit:'h'}
  const rank = s.slice(0, -1).toUpperCase()
  const suit = s.slice(-1).toLowerCase() as Card['suit']
  return { rank, suit }
}

function randomCard(used: string[]): string {
  let c: string
  do {
    c = RANKS[Math.floor(Math.random()*13)] + SUITS[Math.floor(Math.random()*4)]
  } while (used.includes(c))
  return c
}

function dealFull() {
  const used: string[] = []
  const pick = () => { const c = randomCard(used); used.push(c); return c }
  return {
    hole: [pick(), pick()] as [string, string],
    board: [pick(), pick(), pick(), pick(), pick()] as [string,string,string,string,string],
  }
}

// ── Playing Card component ─────────────────────────────────────────────────────

function PlayingCard({
  card, faceDown = false, delay = 0, size = 'md', revealed = false,
}: {
  card: Card | null
  faceDown?: boolean
  delay?: number
  size?: 'sm' | 'md' | 'lg'
  revealed?: boolean
}) {
  const [flipped, setFlipped] = useState(!faceDown)
  useEffect(() => {
    if (revealed && faceDown) {
      const t = setTimeout(() => setFlipped(true), 300)
      return () => clearTimeout(t)
    }
    setFlipped(!faceDown)
  }, [faceDown, revealed])

  const dims = size === 'sm'
    ? { w: 36, h: 50, rank: 'text-sm', sym: 'text-base' }
    : size === 'lg'
    ? { w: 60, h: 84, rank: 'text-xl', sym: 'text-3xl' }
    : { w: 48, h: 68, rank: 'text-base', sym: 'text-2xl' }

  return (
    <motion.div
      initial={{ y: -120, opacity: 0, rotate: (Math.random() - 0.5) * 30 }}
      animate={{ y: 0, opacity: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22, delay }}
      style={{ width: dims.w, height: dims.h, perspective: 600, flexShrink: 0 }}
    >
      <motion.div
        animate={{ rotateY: flipped ? 0 : 180 }}
        transition={{ duration: 0.35, delay: flipped ? 0.1 : 0 }}
        style={{ width: '100%', height: '100%', transformStyle: 'preserve-3d', position: 'relative' }}
      >
        {/* Front */}
        <div style={{
          position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
          background: 'white', borderRadius: 6,
          boxShadow: '0 4px 16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.8)',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 3,
          border: '1px solid rgba(0,0,0,0.15)',
        }}>
          {card && (
            <>
              <div style={{ color: SUIT_COLOR[card.suit], lineHeight: 1 }}>
                <div className={`font-black leading-none ${dims.rank}`}>{card.rank}</div>
                <div style={{ fontSize: dims.w * 0.28 }}>{SUIT_SYM[card.suit]}</div>
              </div>
              <div style={{
                color: SUIT_COLOR[card.suit], fontSize: dims.w * 0.5,
                textAlign: 'center', lineHeight: 1,
              }}>
                {SUIT_SYM[card.suit]}
              </div>
              <div style={{ color: SUIT_COLOR[card.suit], transform: 'rotate(180deg)', lineHeight: 1, textAlign: 'right' }}>
                <div className={`font-black leading-none ${dims.rank}`}>{card.rank}</div>
                <div style={{ fontSize: dims.w * 0.28 }}>{SUIT_SYM[card.suit]}</div>
              </div>
            </>
          )}
        </div>
        {/* Back */}
        <div style={{
          position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)', borderRadius: 6,
          background: 'linear-gradient(135deg, #0a2e18 0%, #1a5c30 50%, #0a2e18 100%)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
          border: '2px solid #1a4a28',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: '78%', height: '78%', border: '2px solid rgba(245,158,11,0.4)',
            borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: 'rgba(245,158,11,0.6)', fontSize: dims.w * 0.4 }}>♠</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Scenario generation ────────────────────────────────────────────────────────

interface Scenario {
  hole: [string, string]
  board: string[]
  fullBoard: string[]
  street: Street
  position: string
  stack: number
  villainStack: number
  pot: number
  villainAction: 'check' | 'bet'
  villainBet: number
}

function generateScenario(): Scenario {
  const { hole, board } = dealFull()
  const street = STREETS[Math.floor(Math.random() * 4)]
  const position = POSITIONS[Math.floor(Math.random() * 6)]
  const stack = Math.round((Math.random() * 150 + 50) * 2) / 2
  const pot = Math.round((Math.random() * 25 + 5) * 2) / 2
  const villainAction = Math.random() > 0.45 ? 'bet' : 'check'
  const villainBet = Math.round(pot * (0.35 + Math.random() * 0.65) * 2) / 2
  const numBoard = street === 'preflop' ? 0 : street === 'flop' ? 3 : street === 'turn' ? 4 : 5

  return {
    hole, board: board.slice(0, numBoard), fullBoard: board,
    street, position, stack, villainStack: stack,
    pot, villainAction, villainBet,
  }
}

// ── Grade styling ──────────────────────────────────────────────────────────────

const GRADE_CONFIG = {
  excellent: { bg: '#14532d', border: '#16a34a', icon: <CheckCircle2 className="w-5 h-5" />, label: 'Отлично!', text: '#4ade80' },
  good:      { bg: '#14532d', border: '#16a34a', icon: <CheckCircle2 className="w-5 h-5" />, label: 'Хорошо!', text: '#4ade80' },
  ok:        { bg: '#1c1917', border: '#78716c', icon: <CheckCircle2 className="w-5 h-5" />, label: 'Приемлемо', text: '#d6d3d1' },
  mistake:   { bg: '#450a0a', border: '#ef4444', icon: <XCircle className="w-5 h-5" />, label: 'Ошибка', text: '#fca5a5' },
  big_mistake: { bg: '#450a0a', border: '#dc2626', icon: <XCircle className="w-5 h-5" />, label: 'Серьёзная ошибка', text: '#fca5a5' },
}

// ── Main Practice Page ─────────────────────────────────────────────────────────

export default function Practice() {
  const [tab, setTab] = useState<'game' | 'quiz'>('game')

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#070e07' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Практика</h1>
            <p className="text-sm mt-0.5" style={{ color: '#4a8a4a' }}>Играй против AI и учись на ошибках</p>
          </div>
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid #1a3a1a' }}>
            {[
              { id: 'game', label: 'Игра', icon: <Swords className="w-3.5 h-3.5" /> },
              { id: 'quiz', label: 'Квиз', icon: <Brain className="w-3.5 h-3.5" /> },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-all"
                style={{
                  background: tab === t.id ? '#15803d' : '#0d1d0d',
                  color: tab === t.id ? 'white' : '#4a8a4a',
                }}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {tab === 'game'
            ? <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><GameMode /></motion.div>
            : <motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><QuizMode /></motion.div>
          }
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Game Mode ──────────────────────────────────────────────────────────────────

type GamePhase = 'idle' | 'dealing' | 'player_turn' | 'evaluating' | 'feedback'

interface Feedback {
  grade: keyof typeof GRADE_CONFIG
  correct: boolean
  title: string
  explanation: string
  optimal: string
}

function GameMode() {
  const [phase, setPhase] = useState<GamePhase>('idle')
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [handCount, setHandCount] = useState(0)

  const dealNewHand = useCallback(() => {
    setFeedback(null)
    setPhase('dealing')
    const s = generateScenario()
    setScenario(s)
    setHandCount(c => c + 1)
    setTimeout(() => setPhase('player_turn'), 800)
  }, [])

  useEffect(() => { dealNewHand() }, [])

  const makeAction = useCallback(async (action: string, label: string) => {
    if (!scenario || phase !== 'player_turn') return
    setPhase('evaluating')

    const villainActionStr = scenario.villainAction === 'check'
      ? 'чек' : `бет ${scenario.villainBet}bb`

    try {
      const resp = await client.post('/web/practice/evaluate', {
        position: scenario.position,
        stack: scenario.stack,
        pot: scenario.pot,
        hole_cards: scenario.hole,
        board: scenario.board,
        street: scenario.street,
        villain_action: villainActionStr,
        player_action: label,
      })
      setFeedback(resp.data)
    } catch {
      setFeedback({
        grade: 'ok', correct: true,
        title: 'Засчитано',
        explanation: 'AI временно недоступен.',
        optimal: '',
      })
    }
    setPhase('feedback')
  }, [scenario, phase])

  const s = scenario

  return (
    <div className="space-y-4">
      {/* Poker Table */}
      <div className="relative rounded-3xl overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse 90% 80% at 50% 50%, #1a5c30 0%, #0f3d1e 60%, #071a0e 100%)',
          border: '3px solid #2d6e3e',
          boxShadow: '0 0 40px rgba(0,0,0,0.8), inset 0 0 60px rgba(0,0,0,0.3)',
          minHeight: 320,
        }}>

        {/* Felt texture overlay */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
        }} />

        {/* Table rail */}
        <div className="absolute inset-0 rounded-3xl" style={{
          boxShadow: 'inset 0 0 0 8px rgba(139,69,19,0.4), inset 0 0 0 10px rgba(0,0,0,0.3)',
        }} />

        <div className="relative z-10 p-6 flex flex-col items-center gap-4">

          {/* Villain */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs"
              style={{ background: 'rgba(0,0,0,0.4)', color: '#9ca3af' }}>
              <div className="w-2 h-2 rounded-full bg-red-500" />
              Оппонент · {s ? `${s.villainStack}bb` : '—'}
            </div>
            <div className="flex gap-2">
              {[0, 1].map(i => (
                <PlayingCard key={`${handCount}-v${i}`} card={null} faceDown delay={i * 0.1} size="md" />
              ))}
            </div>
          </div>

          {/* Board */}
          <div className="flex flex-col items-center gap-2 my-2">
            {s && s.pot > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-sm px-3 py-0.5 rounded-full"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                Пот: {s.pot}bb
              </motion.div>
            )}
            <div className="flex gap-2">
              {s && s.board.length > 0
                ? s.board.map((c, i) => (
                    <PlayingCard key={`${handCount}-b${i}`} card={parseCard(c)} faceDown={false} delay={0.3 + i * 0.12} size="md" />
                  ))
                : <div className="h-16 flex items-center">
                    <span className="text-sm" style={{ color: 'rgba(74,138,74,0.5)' }}>
                      {phase === 'idle' ? '' : 'Префлоп'}
                    </span>
                  </div>
              }
              {/* Empty card placeholders for missing board cards */}
              {s && s.board.length > 0 && Array.from({ length: 5 - s.board.length }).map((_, i) => (
                <div key={`empty-${i}`} style={{
                  width: 48, height: 68, borderRadius: 6,
                  border: '2px dashed rgba(74,138,74,0.2)',
                }} />
              ))}
            </div>
          </div>

          {/* Player cards */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-2">
              {s
                ? s.hole.map((c, i) => (
                    <PlayingCard key={`${handCount}-h${i}`} card={parseCard(c)} faceDown={false} delay={0.1 + i * 0.15} size="lg" />
                  ))
                : [0,1].map(i => (
                    <div key={i} style={{ width: 60, height: 84, borderRadius: 6, background: 'rgba(0,0,0,0.2)', border: '2px dashed rgba(74,138,74,0.15)' }} />
                  ))
              }
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs"
              style={{ background: 'rgba(0,0,0,0.4)', color: '#4ade80' }}>
              <div className="w-2 h-2 rounded-full bg-green-400" />
              Ты · {s ? `${s.stack}bb` : '—'} · {s?.position || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Street + villain action */}
      {s && phase !== 'idle' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl px-4 py-3 flex items-center justify-between"
          style={{ background: '#0d1d0d', border: '1px solid #1a3a1a' }}>
          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-0.5 rounded font-medium"
              style={{ background: '#1a3a1a', color: '#4ade80' }}>
              {s.street === 'preflop' ? 'ПРЕФЛОП' : s.street === 'flop' ? 'ФЛОП' : s.street === 'turn' ? 'ТЁРН' : 'РИВЕР'}
            </span>
            <span className="text-sm" style={{ color: '#9ca3af' }}>
              {s.villainAction === 'check'
                ? 'Оппонент сделал чек'
                : `Оппонент поставил ${s.villainBet}bb`}
            </span>
          </div>
          <span className="text-xs" style={{ color: '#4a8a4a' }}>{s.position}</span>
        </motion.div>
      )}

      {/* Action buttons */}
      {phase === 'player_turn' && s && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-2 gap-2">
          {s.villainAction === 'check' ? (
            <>
              <ActionBtn label="Чек" action="check" color="#1a3a1a" textColor="#4ade80" onAction={makeAction} />
              <ActionBtn label={`Бет ⅓ пота (${Math.round(s.pot/3)}bb)`} action="bet_third" color="#1c3520" textColor="#86efac" onAction={makeAction} />
              <ActionBtn label={`Бет ½ пота (${Math.round(s.pot/2)}bb)`} action="bet_half" color="#166534" textColor="#bbf7d0" onAction={makeAction} />
              <ActionBtn label={`Бет пот (${s.pot}bb)`} action="bet_pot" color="#14532d" textColor="white" bold onAction={makeAction} />
            </>
          ) : (
            <>
              <ActionBtn label="Фолд" action="fold" color="#3b0a0a" textColor="#fca5a5" onAction={makeAction} />
              <ActionBtn label={`Колл ${s.villainBet}bb`} action="call" color="#1a3a1a" textColor="#4ade80" onAction={makeAction} />
              <ActionBtn label={`Рейз до ${Math.round(s.villainBet*2.5)}bb`} action="raise" color="#166534" textColor="#bbf7d0" onAction={makeAction} />
              <ActionBtn label="Олл-ин" action="allin" color="#7c3aed" textColor="white" bold onAction={makeAction} />
            </>
          )}
        </motion.div>
      )}

      {/* Evaluating spinner */}
      {phase === 'evaluating' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-xl p-4 flex items-center gap-3"
          style={{ background: '#0d1d0d', border: '1px solid #1a3a1a' }}>
          <Loader className="w-5 h-5 animate-spin text-green-400 flex-shrink-0" />
          <span className="text-sm" style={{ color: '#4a8a4a' }}>Виктор анализирует твоё решение...</span>
        </motion.div>
      )}

      {/* Feedback */}
      <AnimatePresence>
        {phase === 'feedback' && feedback && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
            className="rounded-xl p-4 space-y-3"
            style={{
              background: GRADE_CONFIG[feedback.grade]?.bg || '#0d1d0d',
              border: `1px solid ${GRADE_CONFIG[feedback.grade]?.border || '#1a3a1a'}`,
            }}>
            <div className="flex items-center gap-2" style={{ color: GRADE_CONFIG[feedback.grade]?.text }}>
              {GRADE_CONFIG[feedback.grade]?.icon}
              <span className="font-bold text-base">{feedback.title}</span>
              <span className="text-xs ml-auto px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(0,0,0,0.3)' }}>
                {GRADE_CONFIG[feedback.grade]?.label}
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#d1fae5' }}>{feedback.explanation}</p>
            {feedback.optimal && (
              <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-xs font-medium mb-1" style={{ color: '#6ee7b7' }}>Оптимально:</p>
                <p className="text-sm" style={{ color: '#a7f3d0' }}>{feedback.optimal}</p>
              </div>
            )}
            <button onClick={dealNewHand}
              className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all mt-1 text-white"
              style={{ background: '#15803d' }}>
              <Shuffle className="w-4 h-4" />
              Следующая раздача
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Idle state */}
      {phase === 'idle' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
          <button onClick={dealNewHand}
            className="px-6 py-3 rounded-xl font-semibold text-white flex items-center gap-2 mx-auto"
            style={{ background: '#15803d' }}>
            <Shuffle className="w-4 h-4" /> Начать игру
          </button>
        </motion.div>
      )}
    </div>
  )
}

function ActionBtn({ label, action, color, textColor, bold = false, onAction }: {
  label: string; action: string; color: string; textColor: string; bold?: boolean
  onAction: (action: string, label: string) => void
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
      onClick={() => onAction(action, label)}
      className={`py-3 px-3 rounded-xl text-sm transition-all ${bold ? 'font-bold' : 'font-medium'}`}
      style={{ background: color, color: textColor, border: `1px solid ${textColor}22` }}>
      {label}
    </motion.button>
  )
}

// ── Quiz Mode ──────────────────────────────────────────────────────────────────

interface QuizQuestion {
  hole_cards: string[]
  board: string[]
  position: string
  stack: number
  pot: number
  villain_action: string
  situation: string
  options: { label: string; action: string }[]
  correct: number
  explanation: string
}

function QuizMode() {
  const [phase, setPhase] = useState<'loading' | 'question' | 'result'>('loading')
  const [quiz, setQuiz] = useState<QuizQuestion | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [quizNum, setQuizNum] = useState(0)
  const [score, setScore] = useState({ correct: 0, total: 0 })

  const loadQuiz = useCallback(async () => {
    setPhase('loading')
    setSelected(null)
    setQuiz(null)
    try {
      const resp = await client.post('/web/practice/quiz', {})
      setQuiz(resp.data)
      setPhase('question')
    } catch {
      setPhase('question') // Will show nothing useful, but keep UI clean
    }
  }, [])

  useEffect(() => { loadQuiz() }, [quizNum])

  const pickAnswer = (i: number) => {
    if (selected !== null) return
    setSelected(i)
    setScore(s => ({ correct: s.correct + (i === quiz?.correct ? 1 : 0), total: s.total + 1 }))
    setPhase('result')
  }

  const q = quiz

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
          <Loader className="w-8 h-8 text-green-400" />
        </motion.div>
        <p className="text-sm" style={{ color: '#4a8a4a' }}>Генерируем сценарий...</p>
      </div>
    )
  }

  if (!q) return null

  return (
    <div className="space-y-4">
      {/* Score */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm" style={{ color: '#4a8a4a' }}>
          Правильных: <span className="text-green-400 font-bold">{score.correct}</span>/{score.total}
        </span>
        <span className="text-xs" style={{ color: '#2d5a2d' }}>Квиз #{quizNum + 1}</span>
      </div>

      {/* Situation */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl p-4" style={{ background: '#0d1d0d', border: '1px solid #1a3a1a' }}>
        <p className="text-sm leading-relaxed" style={{ color: '#9ca3af' }}>{q.situation}</p>
      </motion.div>

      {/* Cards display */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="rounded-2xl p-5"
        style={{
          background: 'radial-gradient(ellipse 90% 80% at 50% 50%, #1a5c30 0%, #0f3d1e 70%, #071a0e 100%)',
          border: '2px solid #2d6e3e',
        }}>
        <div className="flex flex-col items-center gap-4">
          {/* Board */}
          {q.board.length > 0 && (
            <div>
              <p className="text-xs text-center mb-2" style={{ color: 'rgba(74,138,74,0.7)' }}>БОРД</p>
              <div className="flex gap-2 justify-center">
                {q.board.map((c, i) => (
                  <PlayingCard key={`qb${i}-${quizNum}`} card={parseCard(c)} delay={i * 0.08} size="md" />
                ))}
              </div>
            </div>
          )}
          {/* Hole cards */}
          <div>
            <p className="text-xs text-center mb-2" style={{ color: 'rgba(74,138,74,0.7)' }}>ТВОИ КАРТЫ</p>
            <div className="flex gap-2 justify-center">
              {q.hole_cards.map((c, i) => (
                <PlayingCard key={`qh${i}-${quizNum}`} card={parseCard(c)} delay={0.3 + i * 0.1} size="lg" />
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Info bar */}
      <div className="flex gap-2 text-xs flex-wrap">
        {[
          { label: q.position },
          { label: `${q.stack}bb стек` },
          { label: `Пот ${q.pot}bb` },
          { label: `Оппонент: ${q.villain_action}` },
        ].map((item, i) => (
          <span key={i} className="px-2 py-1 rounded-full"
            style={{ background: '#0d1d0d', border: '1px solid #1a3a1a', color: '#4a8a4a' }}>
            {item.label}
          </span>
        ))}
      </div>

      {/* Question */}
      <p className="text-base font-semibold text-white px-1">Что ты сделаешь?</p>

      {/* Options */}
      <div className="space-y-2">
        {q.options.map((opt, i) => {
          const isSelected = selected === i
          const isCorrect = q.correct === i
          const showResult = selected !== null

          let bg = '#0d1d0d'
          let border = '#1a3a1a'
          let textColor = '#e5f5e5'
          if (showResult) {
            if (isCorrect) { bg = '#14532d'; border = '#16a34a'; textColor = '#4ade80' }
            else if (isSelected) { bg = '#450a0a'; border = '#ef4444'; textColor = '#fca5a5' }
            else { textColor = '#4a4a4a' }
          }

          return (
            <motion.button
              key={i}
              onClick={() => pickAnswer(i)}
              disabled={selected !== null}
              whileHover={selected === null ? { scale: 1.01 } : {}}
              whileTap={selected === null ? { scale: 0.99 } : {}}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.06 }}
              className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-3"
              style={{ background: bg, border: `1px solid ${border}`, color: textColor }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                style={{ background: showResult && isCorrect ? '#16a34a' : showResult && isSelected ? '#ef4444' : '#1a3a1a', color: 'white' }}>
                {showResult && isCorrect ? '✓' : showResult && isSelected ? '✗' : 'ABCD'[i]}
              </span>
              {opt.label}
            </motion.button>
          )
        })}
      </div>

      {/* Explanation */}
      <AnimatePresence>
        {phase === 'result' && selected !== null && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl p-4 space-y-3"
            style={{
              background: selected === q.correct ? '#14532d' : '#450a0a',
              border: `1px solid ${selected === q.correct ? '#16a34a' : '#ef4444'}`,
            }}>
            <div className="flex items-center gap-2" style={{ color: selected === q.correct ? '#4ade80' : '#fca5a5' }}>
              {selected === q.correct
                ? <CheckCircle2 className="w-5 h-5" />
                : <XCircle className="w-5 h-5" />}
              <span className="font-bold">{selected === q.correct ? 'Правильно!' : 'Неверно'}</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#d1fae5' }}>{q.explanation}</p>
            <button onClick={() => setQuizNum(n => n + 1)}
              className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 text-white"
              style={{ background: '#15803d' }}>
              <ChevronRight className="w-4 h-4" /> Следующий вопрос
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reload quiz before answering */}
      {phase === 'question' && (
        <button onClick={() => setQuizNum(n => n + 1)}
          className="w-full py-2 text-sm flex items-center justify-center gap-1.5"
          style={{ color: '#2d5a2d' }}>
          <RefreshCw className="w-3.5 h-3.5" /> Другой вопрос
        </button>
      )}
    </div>
  )
}
