import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Spade, ArrowLeft, Loader } from 'lucide-react'
import { useAuth } from '../store/auth'

type Mode = 'login' | 'register'

export default function Auth() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login, register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        if (!firstName.trim()) {
          setError('Введи своё имя')
          setLoading(false)
          return
        }
        await register(email, password, firstName)
      }
      navigate('/app/dashboard')
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      if (typeof detail === 'string') {
        setError(detail)
      } else if (Array.isArray(detail)) {
        setError(detail.map((d: any) => d.msg).join(', '))
      } else {
        setError('Произошла ошибка. Попробуй ещё раз.')
      }
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (newMode: Mode) => {
    setMode(newMode)
    setError('')
  }

  return (
    <div className="min-h-screen bg-poker-bg flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-felt opacity-20" />
      <motion.div
        className="absolute top-1/4 left-1/4 text-8xl text-poker-primary/5 font-black select-none pointer-events-none"
        animate={{ rotate: [0, 5, -5, 0] }}
        transition={{ duration: 8, repeat: Infinity }}
      >
        ♠
      </motion.div>
      <motion.div
        className="absolute bottom-1/4 right-1/4 text-8xl text-red-500/5 font-black select-none pointer-events-none"
        animate={{ rotate: [0, -5, 5, 0] }}
        transition={{ duration: 10, repeat: Infinity, delay: 1 }}
      >
        ♥
      </motion.div>

      <div className="relative z-10 w-full max-w-md">
        {/* Back to landing */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-poker-text-muted hover:text-poker-text transition-colors mb-8 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          На главную
        </button>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-poker-card border border-poker-border rounded-2xl p-8 shadow-2xl"
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-poker-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Spade className="w-8 h-8 text-poker-primary" />
            </div>
            <h1 className="text-2xl font-bold text-poker-primary">Poker Coach AI</h1>
            <p className="text-poker-text-muted text-sm mt-1">Персональный AI-тренер по покеру</p>
          </div>

          {/* Mode tabs */}
          <div className="flex bg-poker-secondary rounded-xl p-1 mb-6">
            {(['login', 'register'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  mode === m
                    ? 'bg-poker-primary text-poker-bg shadow-md'
                    : 'text-poker-text-muted hover:text-poker-text'
                }`}
              >
                {m === 'login' ? 'Войти' : 'Регистрация'}
              </button>
            ))}
          </div>

          {/* Form */}
          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              initial={{ opacity: 0, x: mode === 'register' ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              {mode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-poker-text-muted mb-1.5">
                    Твоё имя
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Иван"
                    className="input-field"
                    required
                    autoComplete="given-name"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-poker-text-muted mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="poker@example.com"
                  className="input-field"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-poker-text-muted mb-1.5">
                  Пароль
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'register' ? 'Минимум 6 символов' : 'Пароль'}
                    className="input-field pr-12"
                    required
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    minLength={mode === 'register' ? 6 : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-poker-text-muted hover:text-poker-text transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-poker-danger/10 border border-poker-danger/30 text-red-400 text-sm rounded-lg px-4 py-3"
                >
                  {error}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 mt-6 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    {mode === 'login' ? 'Вход...' : 'Регистрация...'}
                  </>
                ) : mode === 'login' ? (
                  'Войти'
                ) : (
                  'Создать аккаунт'
                )}
              </button>
            </motion.form>
          </AnimatePresence>

          {/* Switch mode hint */}
          <p className="text-center text-poker-text-muted text-sm mt-6">
            {mode === 'login' ? (
              <>
                Нет аккаунта?{' '}
                <button
                  onClick={() => switchMode('register')}
                  className="text-poker-primary hover:text-poker-primary-dark transition-colors font-medium"
                >
                  Зарегистрироваться
                </button>
              </>
            ) : (
              <>
                Уже есть аккаунт?{' '}
                <button
                  onClick={() => switchMode('login')}
                  className="text-poker-primary hover:text-poker-primary-dark transition-colors font-medium"
                >
                  Войти
                </button>
              </>
            )}
          </p>
        </motion.div>
      </div>
    </div>
  )
}
