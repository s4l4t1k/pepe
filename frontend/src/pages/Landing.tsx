import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Search,
  Camera,
  MessageSquare,
  BookOpen,
  History,
  BarChart3,
  ChevronRight,
  Spade,
  Heart,
  Diamond,
  Club,
} from 'lucide-react'

const features = [
  {
    icon: Search,
    title: 'Анализ раздач',
    desc: 'Отправь текст раздачи — AI разберёт каждую улицу: префлоп, флоп, тёрн, ривер с конкретными цифрами и EV-оценкой',
    color: 'text-poker-primary',
    bg: 'bg-poker-primary/10',
  },
  {
    icon: Camera,
    title: 'Анализ скринов',
    desc: 'Загрузи скриншот покерного стола — Claude Vision распознает ситуацию и даст мгновенный анализ',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
  {
    icon: MessageSquare,
    title: 'AI Тренер',
    desc: 'Задавай любые вопросы о покере. Получай точные ответы с числами и диапазонами, адаптированные под твой уровень',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
  },
  {
    icon: BookOpen,
    title: 'Обучение — 4 модуля',
    desc: 'Основы, постфлоп, продвинутые концепции, банкролл и психология. 15 уроков с квизами и адаптацией под уровень',
    color: 'text-poker-success',
    bg: 'bg-poker-success/10',
  },
  {
    icon: History,
    title: 'История раздач',
    desc: 'Все проанализированные раздачи сохраняются. Перечитывай анализ, отслеживай паттерны ошибок',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
  },
  {
    icon: BarChart3,
    title: 'Прогресс',
    desc: 'Статистика раздач, процент пройденного обучения, бейджи за достижения. Видь свой рост как игрока',
    color: 'text-red-400',
    bg: 'bg-red-400/10',
  },
]

const steps = [
  {
    num: '01',
    title: 'Зарегистрируйся',
    desc: 'Создай аккаунт за 30 секунд. Укажи уровень опыта — AI адаптируется под тебя.',
  },
  {
    num: '02',
    title: 'Анализируй раздачи',
    desc: 'Вставь текст раздачи или загрузи скриншот. Получи детальный разбор с EV-расчётами.',
  },
  {
    num: '03',
    title: 'Учись и расти',
    desc: 'Проходи уроки, задавай вопросы AI-тренеру, отслеживай прогресс.',
  },
]

const floatingCards = [
  { suit: '♠', color: 'text-white', top: '15%', left: '8%', rotate: -15, delay: 0 },
  { suit: '♥', color: 'text-red-400', top: '20%', right: '10%', rotate: 20, delay: 0.5 },
  { suit: '♦', color: 'text-red-500', top: '65%', left: '5%', rotate: 10, delay: 1 },
  { suit: '♣', color: 'text-white', top: '70%', right: '8%', rotate: -20, delay: 1.5 },
  { suit: 'A', color: 'text-poker-primary', top: '40%', left: '3%', rotate: 5, delay: 0.8 },
  { suit: 'K', color: 'text-poker-primary', top: '35%', right: '4%', rotate: -8, delay: 1.2 },
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-poker-bg text-poker-text">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-poker-bg/90 backdrop-blur-sm border-b border-poker-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Spade className="w-6 h-6 text-poker-primary" />
            <span className="font-bold text-poker-primary text-lg">Poker Coach AI</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/auth')}
              className="text-poker-text-muted hover:text-poker-text transition-colors text-sm"
            >
              Войти
            </button>
            <button
              onClick={() => navigate('/auth')}
              className="btn-primary text-sm py-2 px-4"
            >
              Начать бесплатно
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* Background felt */}
        <div className="absolute inset-0 bg-felt opacity-50" />

        {/* Floating cards */}
        {floatingCards.map((card, i) => (
          <motion.div
            key={i}
            className={`absolute text-5xl font-bold ${card.color} opacity-20 select-none pointer-events-none`}
            style={{
              top: card.top,
              left: card.left,
              right: card.right,
              rotate: card.rotate,
            }}
            animate={{
              y: [0, -15, 0],
              rotate: [card.rotate, card.rotate + 5, card.rotate],
            }}
            transition={{
              duration: 4,
              delay: card.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {card.suit}
          </motion.div>
        ))}

        <div className="relative z-10 text-center max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="text-poker-primary text-lg">♠</span>
              <span className="text-sm text-poker-text-muted uppercase tracking-widest font-medium">
                Персональный тренер
              </span>
              <span className="text-red-400 text-lg">♥</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
              <span className="text-poker-primary">POKER</span>{' '}
              <span className="text-poker-text">COACH</span>
              <br />
              <span className="text-poker-text">AI</span>
            </h1>

            <p className="text-xl md:text-2xl text-poker-text-muted mb-10 max-w-2xl mx-auto leading-relaxed">
              Персональный AI-тренер по покеру. Анализируй раздачи,{' '}
              <span className="text-poker-text">учись у лучших концепций</span> и расти как игрок.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/auth')}
                className="btn-primary flex items-center gap-2 text-lg py-4 px-8 animate-pulse-gold"
              >
                Начать бесплатно
                <ChevronRight className="w-5 h-5" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="btn-secondary flex items-center gap-2 text-lg py-4 px-8"
              >
                Узнать больше
              </motion.button>
            </div>

            <div className="flex items-center justify-center gap-8 mt-12 text-poker-text-muted">
              <div className="text-center">
                <div className="text-2xl font-bold text-poker-primary">15+</div>
                <div className="text-xs">уроков</div>
              </div>
              <div className="w-px h-8 bg-poker-border" />
              <div className="text-center">
                <div className="text-2xl font-bold text-poker-primary">4</div>
                <div className="text-xs">модуля</div>
              </div>
              <div className="w-px h-8 bg-poker-border" />
              <div className="text-center">
                <div className="text-2xl font-bold text-poker-primary">AI</div>
                <div className="text-xs">анализ</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <div className="w-6 h-10 border-2 border-poker-border rounded-full flex items-start justify-center p-1">
            <div className="w-1.5 h-3 bg-poker-primary rounded-full" />
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-4">Всё для роста игры</h2>
            <p className="text-poker-text-muted text-lg max-w-2xl mx-auto">
              Полный набор инструментов для анализа, обучения и работы над покером
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -4 }}
                  className="card hover:border-poker-accent transition-all cursor-default"
                >
                  <div className={`w-12 h-12 ${feature.bg} rounded-xl flex items-center justify-center mb-4`}>
                    <Icon className={`w-6 h-6 ${feature.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-poker-text-muted text-sm leading-relaxed">{feature.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-4 bg-poker-card/50">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-4">Как это работает</h2>
            <p className="text-poker-text-muted text-lg">Три шага к улучшению игры</p>
          </motion.div>

          <div className="space-y-8">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="flex gap-6 items-start"
              >
                <div className="flex-shrink-0 w-16 h-16 bg-poker-primary/20 border border-poker-primary/30 rounded-2xl flex items-center justify-center">
                  <span className="text-poker-primary font-black text-lg">{step.num}</span>
                </div>
                <div className="pt-2">
                  <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-poker-text-muted leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <div className="text-5xl mb-6">🃏</div>
            <h2 className="text-4xl font-bold mb-4">Готов расти как игрок?</h2>
            <p className="text-poker-text-muted text-lg mb-8">
              Регистрация бесплатна. Начни анализировать раздачи прямо сейчас.
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/auth')}
              className="btn-primary text-lg py-4 px-10"
            >
              Начать бесплатно
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-poker-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Spade className="w-5 h-5 text-poker-primary" />
            <span className="font-bold text-poker-primary">Poker Coach AI</span>
          </div>
          <p className="text-poker-text-muted text-sm">
            Персональный AI-тренер по покеру
          </p>
          <div className="flex gap-4 text-poker-text-muted text-2xl">
            <span>♠</span>
            <span className="text-red-400">♥</span>
            <span className="text-red-400">♦</span>
            <span>♣</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
