import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Search,
  Camera,
  MessageSquare,
  BookOpen,
  History,
  User,
  ChevronRight,
  TrendingUp,
} from 'lucide-react'
import { useAuth } from '../store/auth'

const experienceLabels: Record<string, { label: string; emoji: string; color: string }> = {
  beginner: { label: 'Новичок', emoji: '🟢', color: 'text-green-400 bg-green-400/10 border-green-400/30' },
  amateur: { label: 'Любитель', emoji: '🟡', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
  semipro: { label: 'Полурег', emoji: '🔵', color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  pro: { label: 'Регуляр', emoji: '🔴', color: 'text-red-400 bg-red-400/10 border-red-400/30' },
}

const featureCards = [
  {
    path: '/app/analyze',
    icon: Search,
    title: 'Анализ раздачи',
    desc: 'Разбор текста раздачи с EV-оценкой',
    color: 'text-poker-primary',
    bg: 'bg-poker-primary/10 hover:bg-poker-primary/20',
    border: 'border-poker-primary/20 hover:border-poker-primary/40',
  },
  {
    path: '/app/analyze',
    icon: Camera,
    title: 'Анализ скрина',
    desc: 'Загрузи скриншот — AI разберёт ситуацию',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10 hover:bg-blue-400/20',
    border: 'border-blue-400/20 hover:border-blue-400/40',
  },
  {
    path: '/app/training',
    icon: BookOpen,
    title: 'Обучение',
    desc: '4 модуля, 15 уроков с квизами',
    color: 'text-poker-success',
    bg: 'bg-poker-success/10 hover:bg-poker-success/20',
    border: 'border-poker-success/20 hover:border-poker-success/40',
  },
  {
    path: '/app/assistant',
    icon: MessageSquare,
    title: 'AI Тренер',
    desc: 'Задавай вопросы о покере',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10 hover:bg-purple-400/20',
    border: 'border-purple-400/20 hover:border-purple-400/40',
  },
  {
    path: '/app/history',
    icon: History,
    title: 'История',
    desc: 'Все проанализированные раздачи',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10 hover:bg-orange-400/20',
    border: 'border-orange-400/20 hover:border-orange-400/40',
  },
  {
    path: '/app/profile',
    icon: User,
    title: 'Профиль',
    desc: 'Настройки и прогресс',
    color: 'text-pink-400',
    bg: 'bg-pink-400/10 hover:bg-pink-400/20',
    border: 'border-pink-400/20 hover:border-pink-400/40',
  },
]

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const level = user?.experience_level ? experienceLabels[user.experience_level] : null

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-poker-text">
              Привет, {user?.first_name}! 👋
            </h1>
            <p className="text-poker-text-muted mt-1">Готов работать над игрой?</p>
          </div>
          {level && (
            <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${level.color}`}>
              {level.emoji} {level.label}
            </span>
          )}
        </div>
      </motion.div>

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8"
      >
        <div className="card text-center">
          <div className="text-3xl font-black text-poker-primary">{user?.hands_analyzed_count || 0}</div>
          <div className="text-poker-text-muted text-sm mt-1">раздач проанализировано</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-black text-poker-success">4</div>
          <div className="text-poker-text-muted text-sm mt-1">модуля обучения</div>
        </div>
        <div className="card text-center col-span-2 md:col-span-1">
          <div className="flex items-center justify-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-poker-primary" />
            <div className="text-3xl font-black text-poker-primary">AI</div>
          </div>
          <div className="text-poker-text-muted text-sm">тренер активен</div>
        </div>
      </motion.div>

      {/* Feature cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-lg font-semibold mb-4 text-poker-text-muted">Что хочешь сделать?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {featureCards.map((card, i) => {
            const Icon = card.icon
            return (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(card.path)}
                className={`text-left p-5 rounded-xl border ${card.bg} ${card.border} transition-all duration-200 group`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.bg}`}>
                    <Icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                  <ChevronRight className={`w-4 h-4 ${card.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                </div>
                <h3 className="font-semibold text-poker-text mb-1">{card.title}</h3>
                <p className="text-poker-text-muted text-sm">{card.desc}</p>
              </motion.button>
            )
          })}
        </div>
      </motion.div>

      {/* Quick tip */}
      {!user?.experience_level && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 p-4 bg-poker-primary/10 border border-poker-primary/30 rounded-xl flex items-start gap-3"
        >
          <span className="text-2xl flex-shrink-0">💡</span>
          <div>
            <p className="font-medium text-poker-primary">Укажи свой уровень</p>
            <p className="text-poker-text-muted text-sm mt-0.5">
              AI адаптирует объяснения под твой опыт.{' '}
              <button onClick={() => navigate('/app/profile')} className="text-poker-primary hover:underline">
                Настроить профиль →
              </button>
            </p>
          </div>
        </motion.div>
      )}
    </div>
  )
}
