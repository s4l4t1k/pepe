import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Loader, Mail, RefreshCw, Send } from 'lucide-react'
import { authAPI } from '../api/client'

type Step = 'email' | 'code' | 'telegram'

export default function Auth() {
  const [step, setStep] = useState<Step>('email')

  // Email OTP state
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [isNew, setIsNew] = useState(false)
  const [emailCode, setEmailCode] = useState(['', '', '', '', '', ''])
  const [resendTimer, setResendTimer] = useState(0)

  // Telegram OTP state
  const [tgSessionToken, setTgSessionToken] = useState('')
  const [tgBotUsername, setTgBotUsername] = useState('')
  const [tgCode, setTgCode] = useState(['', '', '', '', '', ''])

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const [telegramEnabled, setTelegramEnabled] = useState(false)

  const emailInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const tgInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const navigate = useNavigate()

  // Handle ?token= from Google OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const err = params.get('error')
    if (token) {
      setLoading(true)
      authAPI.me().then(resp => {
        localStorage.setItem('poker_token', token)
        localStorage.setItem('poker_user', JSON.stringify(resp.data))
        window.location.href = '/app/trainer'
      }).catch(() => {
        localStorage.setItem('poker_token', token)
        window.location.href = '/app/trainer'
      })
      return
    }
    if (err) {
      setError('Не удалось войти через Google. Попробуй другой способ')
      window.history.replaceState({}, '', '/auth')
    }
  }, [])

  // Load social config
  useEffect(() => {
    authAPI.socialConfig().then(r => {
      setGoogleEnabled(r.data.google_enabled)
      setTelegramEnabled(!!r.data.telegram_bot_username)
      if (r.data.telegram_bot_username) setTgBotUsername(r.data.telegram_bot_username)
    }).catch(() => {})
  }, [])

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer <= 0) return
    const t = setTimeout(() => setResendTimer(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [resendTimer])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const saveAndRedirect = (token: string, user: any) => {
    localStorage.setItem('poker_token', token)
    localStorage.setItem('poker_user', JSON.stringify(user))
    window.location.href = '/app/trainer'
  }

  const makeCodeHandlers = (
    codeState: string[],
    setCode: (c: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    onComplete: (code: string) => void,
  ) => ({
    onInput: (i: number, val: string) => {
      const digit = val.replace(/\D/g, '').slice(-1)
      const next = [...codeState]; next[i] = digit
      setCode(next); setError('')
      if (digit && i < 5) refs.current[i + 1]?.focus()
      if (next.every(d => d)) setTimeout(() => onComplete(next.join('')), 50)
    },
    onKeyDown: (i: number, e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !codeState[i] && i > 0) refs.current[i - 1]?.focus()
    },
    onPaste: (e: React.ClipboardEvent) => {
      const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
      if (text.length === 6) {
        setCode(text.split(''))
        refs.current[5]?.focus()
        setTimeout(() => onComplete(text), 50)
      }
    },
  })

  // ── Email OTP ──────────────────────────────────────────────────────────────

  const sendEmailCode = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!email.trim()) return setError('Введи email')
    setError(''); setLoading(true)
    try {
      const resp = await authAPI.sendCode(email.trim().toLowerCase())
      setIsNew(resp.data.is_new)
      setStep('code')
      setEmailCode(['', '', '', '', '', ''])
      setResendTimer(60)
      setTimeout(() => emailInputRefs.current[0]?.focus(), 100)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Не удалось отправить код')
    } finally { setLoading(false) }
  }

  const verifyEmailCode = async (codeStr?: string) => {
    const fullCode = codeStr || emailCode.join('')
    if (fullCode.length !== 6) return setError('Введи 6-значный код')
    if (isNew && !firstName.trim()) return setError('Введи своё имя')
    setError(''); setLoading(true)
    try {
      const resp = await authAPI.verifyCode(email, fullCode, isNew ? firstName.trim() : undefined)
      saveAndRedirect(resp.data.access_token, resp.data.user)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Неверный код')
      setEmailCode(['', '', '', '', '', ''])
      setTimeout(() => emailInputRefs.current[0]?.focus(), 50)
    } finally { setLoading(false) }
  }

  const emailHandlers = makeCodeHandlers(emailCode, setEmailCode, emailInputRefs, verifyEmailCode)

  // ── Telegram OTP ───────────────────────────────────────────────────────────

  const startTelegramLogin = async () => {
    setError(''); setLoading(true)
    try {
      const resp = await authAPI.telegramInit()
      const { session_token, bot_username } = resp.data
      setTgSessionToken(session_token)
      setTgBotUsername(bot_username)
      setStep('telegram')
      setTgCode(['', '', '', '', '', ''])
      window.open(`https://t.me/${bot_username}?start=login_${session_token}`, '_blank')
      setTimeout(() => tgInputRefs.current[0]?.focus(), 300)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Не удалось начать вход через Telegram')
    } finally { setLoading(false) }
  }

  const verifyTgCode = async (codeStr?: string) => {
    const fullCode = codeStr || tgCode.join('')
    if (fullCode.length !== 6) return setError('Введи 6-значный код из бота')
    setError(''); setLoading(true)
    try {
      const resp = await authAPI.telegramVerify(tgSessionToken, fullCode)
      saveAndRedirect(resp.data.access_token, resp.data.user)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Неверный код')
      setTgCode(['', '', '', '', '', ''])
      setTimeout(() => tgInputRefs.current[0]?.focus(), 50)
    } finally { setLoading(false) }
  }

  const tgHandlers = makeCodeHandlers(tgCode, setTgCode, tgInputRefs, verifyTgCode)

  // ── Render helpers ─────────────────────────────────────────────────────────

  const CodeInputRow = ({
    code, handlers, refs,
  }: {
    code: string[]
    handlers: ReturnType<typeof makeCodeHandlers>
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  }) => (
    <div className="flex gap-2 justify-center" onPaste={handlers.onPaste}>
      {code.map((digit, i) => (
        <input key={i} ref={el => { refs.current[i] = el }}
          type="text" inputMode="numeric" maxLength={1} value={digit}
          onChange={e => handlers.onInput(i, e.target.value)}
          onKeyDown={e => handlers.onKeyDown(i, e)}
          className="w-11 h-14 text-center text-2xl font-bold rounded-xl outline-none transition-all"
          style={{
            background: digit ? '#1a3a1a' : '#0d1d0d',
            border: `1px solid ${digit ? '#4ade80' : '#1a3a1a'}`,
            color: '#f59e0b',
          }}
          onFocus={e => (e.target.style.borderColor = 'rgba(74,222,128,0.6)')}
          onBlur={e => (e.target.style.borderColor = digit ? '#4ade80' : '#1a3a1a')} />
      ))}
    </div>
  )

  const goBack = () => {
    if (step === 'code') { setStep('email'); setEmailCode(['','','','','','']) }
    else if (step === 'telegram') { setStep('email'); setTgCode(['','','','','','']) }
    else navigate('/')
    setError('')
  }

  const hasSocial = googleEnabled || telegramEnabled

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#070e07' }}>
      <motion.div className="fixed top-1/4 left-1/4 text-9xl select-none pointer-events-none"
        style={{ color: 'rgba(245,158,11,0.03)' }}
        animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 8, repeat: Infinity }}>♠</motion.div>
      <motion.div className="fixed bottom-1/4 right-1/4 text-9xl select-none pointer-events-none"
        style={{ color: 'rgba(245,158,11,0.03)' }}
        animate={{ rotate: [0, -5, 5, 0] }} transition={{ duration: 10, repeat: Infinity, delay: 1 }}>♣</motion.div>

      <div className="relative z-10 w-full max-w-sm">
        <button onClick={goBack} className="flex items-center gap-2 text-sm mb-8 transition-colors"
          style={{ color: '#4a8a4a' }}>
          <ArrowLeft className="w-4 h-4" />
          {step !== 'email' ? 'Назад' : 'На главную'}
        </button>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-8 shadow-2xl"
          style={{ background: '#0c1a0c', border: '1px solid #1a3a1a' }}>

          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(245,158,11,0.15)' }}>
              <span className="text-3xl">♠</span>
            </div>
            <h1 className="text-xl font-bold text-white">Poker Coach AI</h1>
            <p className="text-sm mt-1" style={{ color: '#4a8a4a' }}>Персональный тренер по покеру</p>
          </div>

          <AnimatePresence mode="wait">

            {/* ── Step: email ── */}
            {step === 'email' && (
              <motion.div key="email" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }} className="space-y-3">

                {hasSocial && (
                  <>
                    {googleEnabled && (
                      <a href="/api/auth/google"
                        className="flex items-center justify-center gap-3 w-full py-3 rounded-xl text-sm font-medium transition-all"
                        style={{ background: '#0d1d0d', border: '1px solid #1a3a1a', color: '#e5f5e5' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(74,222,128,0.4)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#1a3a1a')}>
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Войти через Google
                      </a>
                    )}

                    {telegramEnabled && (
                      <button onClick={startTelegramLogin} disabled={loading}
                        className="flex items-center justify-center gap-3 w-full py-3 rounded-xl text-sm font-medium transition-all"
                        style={{ background: '#0d1d0d', border: '1px solid #1a3a1a', color: '#e5f5e5', opacity: loading ? 0.6 : 1 }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(74,222,128,0.4)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#1a3a1a')}>
                        {loading
                          ? <Loader className="w-5 h-5 animate-spin" />
                          : <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="12" fill="#229ED9"/>
                              <path d="M5.5 11.5L17 7l-3 10-2.5-3.5L5.5 11.5z" fill="white" stroke="white" strokeWidth="0.5" strokeLinejoin="round"/>
                              <path d="M11.5 13.5L14 11" stroke="white" strokeWidth="0.8"/>
                            </svg>
                        }
                        Войти через Telegram
                      </button>
                    )}

                    <div className="flex items-center gap-3 pt-1">
                      <div className="flex-1 h-px" style={{ background: '#1a3a1a' }} />
                      <span className="text-xs" style={{ color: '#2d5a2d' }}>или по email</span>
                      <div className="flex-1 h-px" style={{ background: '#1a3a1a' }} />
                    </div>
                  </>
                )}

                <form onSubmit={sendEmailCode} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#4a8a4a' }}>Email</label>
                    <input type="email" value={email}
                      onChange={e => { setEmail(e.target.value); setError('') }}
                      placeholder="poker@example.com" required
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                      style={{ background: '#0d1d0d', border: '1px solid #1a3a1a', color: '#e5f5e5' }}
                      onFocus={e => (e.target.style.borderColor = 'rgba(74,222,128,0.4)')}
                      onBlur={e => (e.target.style.borderColor = '#1a3a1a')} />
                  </div>
                  {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-sm">{error}</motion.p>}
                  <button type="submit" disabled={loading || !email.trim()}
                    className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all text-white"
                    style={{ background: '#15803d', opacity: loading || !email.trim() ? 0.5 : 1 }}>
                    {loading ? <><Loader className="w-4 h-4 animate-spin" />Отправляем...</> : <><Mail className="w-4 h-4" />Получить код</>}
                  </button>
                </form>
              </motion.div>
            )}

            {/* ── Step: email code ── */}
            {step === 'code' && (
              <motion.div key="code" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }} className="space-y-5">

                <div className="text-center">
                  <p className="text-sm" style={{ color: '#4a8a4a' }}>Код отправлен на</p>
                  <p className="text-sm font-semibold text-white mt-0.5">{email}</p>
                </div>

                {isNew && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#4a8a4a' }}>Твоё имя</label>
                    <input type="text" value={firstName}
                      onChange={e => { setFirstName(e.target.value); setError('') }}
                      placeholder="Иван" autoFocus
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                      style={{ background: '#0d1d0d', border: '1px solid #1a3a1a', color: '#e5f5e5' }}
                      onFocus={e => (e.target.style.borderColor = 'rgba(74,222,128,0.4)')}
                      onBlur={e => (e.target.style.borderColor = '#1a3a1a')} />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium mb-3 text-center" style={{ color: '#4a8a4a' }}>Введи код из письма</label>
                  <CodeInputRow code={emailCode} handlers={emailHandlers} refs={emailInputRefs} />
                </div>

                {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-sm text-center">{error}</motion.p>}

                <button onClick={() => verifyEmailCode()}
                  disabled={loading || emailCode.join('').length !== 6 || (isNew && !firstName.trim())}
                  className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 text-white transition-all"
                  style={{ background: '#15803d', opacity: loading || emailCode.join('').length !== 6 ? 0.5 : 1 }}>
                  {loading ? <><Loader className="w-4 h-4 animate-spin" />Проверяем...</> : 'Войти'}
                </button>

                <button onClick={() => { if (resendTimer === 0) sendEmailCode() }}
                  disabled={resendTimer > 0 || loading}
                  className="w-full py-2 text-sm flex items-center justify-center gap-1.5 transition-colors"
                  style={{ color: resendTimer > 0 ? '#2d5a2d' : '#4a8a4a' }}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  {resendTimer > 0 ? `Повторить через ${resendTimer}с` : 'Отправить новый код'}
                </button>
              </motion.div>
            )}

            {/* ── Step: telegram code ── */}
            {step === 'telegram' && (
              <motion.div key="telegram" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }} className="space-y-5">

                <div className="text-center space-y-3">
                  <div className="rounded-xl p-4 text-sm" style={{ background: '#0d1d0d', border: '1px solid #1a3a1a' }}>
                    <p style={{ color: '#4a8a4a' }}>1. Нажми кнопку ниже</p>
                    <p style={{ color: '#4a8a4a' }}>2. В боте нажми <b className="text-green-400">Старт</b></p>
                    <p style={{ color: '#4a8a4a' }}>3. Скопируй код и введи здесь</p>
                  </div>
                  <a href={`https://t.me/${tgBotUsername}?start=login_${tgSessionToken}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-white"
                    style={{ background: '#229ED9' }}>
                    <Send className="w-4 h-4" />
                    Открыть @{tgBotUsername}
                  </a>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-3 text-center" style={{ color: '#4a8a4a' }}>Код из бота</label>
                  <CodeInputRow code={tgCode} handlers={tgHandlers} refs={tgInputRefs} />
                </div>

                {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-sm text-center">{error}</motion.p>}

                <button onClick={() => verifyTgCode()}
                  disabled={loading || tgCode.join('').length !== 6}
                  className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 text-white transition-all"
                  style={{ background: '#15803d', opacity: loading || tgCode.join('').length !== 6 ? 0.5 : 1 }}>
                  {loading ? <><Loader className="w-4 h-4 animate-spin" />Проверяем...</> : 'Войти'}
                </button>

                <button onClick={startTelegramLogin} disabled={loading}
                  className="w-full py-2 text-sm flex items-center justify-center gap-1.5"
                  style={{ color: '#4a8a4a' }}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Запросить новый код
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
