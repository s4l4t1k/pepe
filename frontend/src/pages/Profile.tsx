import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  User,
  BarChart3,
  BookOpen,
  Award,
  Edit3,
  Loader,
  Check,
  X,
} from 'lucide-react'
import { useAuth } from '../store/auth'
import { webAPI, authAPI } from '../api/client'

const EXPERIENCE_OPTIONS = [
  { value: 'beginner', label: 'Новичок', desc: '< 1 года, играю ради фана', emoji: '🟢', color: 'text-green-400 border-green-400/40 bg-green-400/10' },
  { value: 'amateur', label: 'Любитель', desc: '1-3 года, нерегулярно', emoji: '🟡', color: 'text-yellow-400 border-yellow-400/40 bg-yellow-400/10' },
  { value: 'semipro', label: 'Полурег', desc: '3-5 лет, серьёзно', emoji: '🔵', color: 'text-blue-400 border-blue-400/40 bg-blue-400/10' },
  { value: 'pro', label: 'Регуляр', desc: '5+ лет, профессионально', emoji: '🔴', color: 'text-red-400 border-red-400/40 bg-red-400/10' },
]

const STYLE_OPTIONS = [
  { value: 'lag', label: 'LAG', desc: 'Loose-Aggressive', emoji: '🦁' },
  { value: 'tag', label: 'TAG', desc: 'Tight-Aggressive', emoji: '🐢' },
  { value: 'lap', label: 'LAP', desc: 'Loose-Passive', emoji: '🦊' },
  { value: 'tap', label: 'TAP', desc: 'Tight-Passive', emoji: '🛡️' },
  { value: 'unknown', label: 'Не знаю', desc: 'AI поможет определить', emoji: '🤔' },
]

interface Stats {
  hands_analyzed_count: number
  lessons_completed_count: number
}

function getBadges(stats: Stats, expLevel: string | null) {
  const badges = []
  if (stats.hands_analyzed_count >= 1) badges.push({ label: 'Первая раздача', emoji: '🃏', desc: 'Проанализировал первую раздачу' })
  if (stats.hands_analyzed_count >= 10) badges.push({ label: '10 раздач', emoji: '📊', desc: '10 проанализированных раздач' })
  if (stats.hands_analyzed_count >= 50) badges.push({ label: '50 раздач', emoji: '🏆', desc: '50 проанализированных раздач' })
  if (stats.lessons_completed_count >= 1) badges.push({ label: 'Первый урок', emoji: '📚', desc: 'Прошёл первый урок' })
  if (stats.lessons_completed_count >= 5) badges.push({ label: '5 уроков', emoji: '🎯', desc: '5 пройденных уроков' })
  if (stats.lessons_completed_count >= 15) badges.push({ label: 'Полный курс', emoji: '🌟', desc: 'Прошёл все уроки' })
  if (expLevel) badges.push({ label: 'Профиль заполнен', emoji: '✅', desc: 'Указал уровень опыта' })
  return badges
}

export default function Profile() {
  const { user, updateUser } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [editingExp, setEditingExp] = useState(false)
  const [editingStyle, setEditingStyle] = useState(false)
  const [savingExp, setSavingExp] = useState(false)
  const [savingStyle, setSavingStyle] = useState(false)
  const [selectedExp, setSelectedExp] = useState(user?.experience_level || '')
  const [selectedStyle, setSelectedStyle] = useState(user?.play_style || '')

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const resp = await webAPI.getProfile()
      setStats({
        hands_analyzed_count: resp.data.hands_analyzed_count,
        lessons_completed_count: resp.data.lessons_completed_count,
      })
    } catch {
      // ignore
    } finally {
      setLoadingStats(false)
    }
  }

  const saveExperience = async () => {
    if (!selectedExp) return
    setSavingExp(true)
    try {
      const resp = await authAPI.updateProfile({ experience_level: selectedExp })
      updateUser(resp.data)
      setEditingExp(false)
    } catch {
      // ignore
    } finally {
      setSavingExp(false)
    }
  }

  const saveStyle = async () => {
    if (!selectedStyle) return
    setSavingStyle(true)
    try {
      const resp = await authAPI.updateProfile({ play_style: selectedStyle })
      updateUser(resp.data)
      setEditingStyle(false)
    } catch {
      // ignore
    } finally {
      setSavingStyle(false)
    }
  }

  const currentExp = EXPERIENCE_OPTIONS.find((e) => e.value === user?.experience_level)
  const currentStyle = STYLE_OPTIONS.find((s) => s.value === user?.play_style)
  const badges = stats ? getBadges(stats, user?.experience_level || null) : []

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold mb-6">Профиль</h1>

        {/* User info */}
        <div className="card mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-poker-secondary rounded-2xl flex items-center justify-center border border-poker-border">
              <span className="text-2xl font-black text-poker-primary">
                {user?.first_name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold">{user?.first_name}</h2>
              <p className="text-poker-text-muted text-sm">{user?.email}</p>
              <p className="text-poker-text-muted text-xs mt-1">
                Участник с {user?.created_at ? new Date(user.created_at).toLocaleDateString('ru', { month: 'long', year: 'numeric' }) : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="card text-center">
            <div className="text-3xl font-black text-poker-primary mb-1">
              {loadingStats ? <Loader className="w-6 h-6 animate-spin mx-auto" /> : (stats?.hands_analyzed_count || 0)}
            </div>
            <div className="text-poker-text-muted text-sm flex items-center justify-center gap-1.5">
              <BarChart3 className="w-4 h-4" />
              раздач
            </div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-black text-poker-success mb-1">
              {loadingStats ? <Loader className="w-6 h-6 animate-spin mx-auto" /> : (stats?.lessons_completed_count || 0)}
            </div>
            <div className="text-poker-text-muted text-sm flex items-center justify-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              уроков
            </div>
          </div>
        </div>

        {/* Experience level */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <User className="w-5 h-5 text-poker-primary" />
              Уровень опыта
            </h3>
            {!editingExp && (
              <button
                onClick={() => { setEditingExp(true); setSelectedExp(user?.experience_level || '') }}
                className="text-xs text-poker-text-muted hover:text-poker-primary flex items-center gap-1 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Изменить
              </button>
            )}
          </div>

          {!editingExp ? (
            currentExp ? (
              <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${currentExp.color}`}>
                <span className="text-2xl">{currentExp.emoji}</span>
                <div>
                  <div className="font-medium">{currentExp.label}</div>
                  <div className="text-xs opacity-75">{currentExp.desc}</div>
                </div>
              </div>
            ) : (
              <p className="text-poker-text-muted text-sm">
                Уровень не указан.{' '}
                <button onClick={() => setEditingExp(true)} className="text-poker-primary hover:underline">
                  Указать →
                </button>
              </p>
            )
          ) : (
            <div>
              <div className="grid grid-cols-1 gap-2 mb-4">
                {EXPERIENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedExp(opt.value)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left ${
                      selectedExp === opt.value
                        ? opt.color + ' ring-1 ring-current'
                        : 'border-poker-border bg-poker-secondary hover:border-poker-accent'
                    }`}
                  >
                    <span className="text-xl">{opt.emoji}</span>
                    <div>
                      <div className="font-medium text-sm">{opt.label}</div>
                      <div className="text-xs text-poker-text-muted">{opt.desc}</div>
                    </div>
                    {selectedExp === opt.value && <Check className="w-4 h-4 ml-auto flex-shrink-0" />}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveExperience}
                  disabled={savingExp || !selectedExp}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 py-2 text-sm disabled:opacity-60"
                >
                  {savingExp ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Сохранить
                </button>
                <button
                  onClick={() => setEditingExp(false)}
                  className="btn-secondary flex items-center justify-center gap-2 py-2 px-4 text-sm"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Play style */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-poker-primary" />
              Стиль игры
            </h3>
            {!editingStyle && (
              <button
                onClick={() => { setEditingStyle(true); setSelectedStyle(user?.play_style || '') }}
                className="text-xs text-poker-text-muted hover:text-poker-primary flex items-center gap-1 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Изменить
              </button>
            )}
          </div>

          {!editingStyle ? (
            currentStyle ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-poker-border bg-poker-secondary">
                <span className="text-2xl">{currentStyle.emoji}</span>
                <div>
                  <div className="font-medium">{currentStyle.label}</div>
                  <div className="text-xs text-poker-text-muted">{currentStyle.desc}</div>
                </div>
              </div>
            ) : (
              <p className="text-poker-text-muted text-sm">
                Стиль не указан.{' '}
                <button onClick={() => setEditingStyle(true)} className="text-poker-primary hover:underline">
                  Указать →
                </button>
              </p>
            )
          ) : (
            <div>
              <div className="grid grid-cols-1 gap-2 mb-4">
                {STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedStyle(opt.value)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left ${
                      selectedStyle === opt.value
                        ? 'border-poker-primary bg-poker-primary/10 text-poker-primary'
                        : 'border-poker-border bg-poker-secondary hover:border-poker-accent'
                    }`}
                  >
                    <span className="text-xl">{opt.emoji}</span>
                    <div>
                      <div className="font-medium text-sm">{opt.label}</div>
                      <div className="text-xs text-poker-text-muted">{opt.desc}</div>
                    </div>
                    {selectedStyle === opt.value && <Check className="w-4 h-4 ml-auto flex-shrink-0 text-poker-primary" />}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveStyle}
                  disabled={savingStyle || !selectedStyle}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 py-2 text-sm disabled:opacity-60"
                >
                  {savingStyle ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Сохранить
                </button>
                <button
                  onClick={() => setEditingStyle(false)}
                  className="btn-secondary flex items-center justify-center gap-2 py-2 px-4 text-sm"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-poker-primary" />
            Достижения
          </h3>

          {badges.length === 0 ? (
            <p className="text-poker-text-muted text-sm">
              Проанализируй первую раздачу или пройди урок, чтобы получить бейдж
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {badges.map((badge, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-3 bg-poker-secondary border border-poker-border rounded-xl"
                >
                  <span className="text-2xl">{badge.emoji}</span>
                  <div>
                    <div className="text-sm font-medium">{badge.label}</div>
                    <div className="text-xs text-poker-text-muted">{badge.desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
