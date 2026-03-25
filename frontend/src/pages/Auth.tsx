import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Loader, Mail, RefreshCw } from 'lucide-react'
import { authAPI, SocialConfig } from '../api/client'

type Step = 'email' | 'code'

declare global {
  interface Window {
    onTelegramAuth: (user: Record<string, string | number>) => void
  }
}

function TelegramButton({ botUsername, onAuth }: {
  botUsername: string
  onAuth: (user: Record<string, string | number>) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || !botUsername) return
    window.onTelegramAuth = onAuth

    const script = document.createElement('script')
    script.async = true
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', botUsername)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    script.setAttribute('data-radius', '12')
    containerRef.current.appendChild(script)

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [botUsername])

  return <div ref={containerRef} className="flex justify-center" />
}

export default function Auth() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [isNew, setIsNew] = useState(false)
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [socialCfg, setSocialCfg] = useState<SocialConfig | null>(null)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const navigate = useNavigate()

  // Handle Google OAuth redirect: /auth?token=JWT
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
        // Store token anyway and redirect
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

  // Load social auth config
  useEffect(() => {
    authAPI.socialConfig().then(r => setSocialCfg(r.data)).catch(() => {})
  }, [])

  // Resend timer
  useEffect(() => {
    if (resendTimer <= 0) return
    const t = setTimeout(() => setResendTimer(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [resendTimer])

  const handleSocialLogin = async (data: Record<string, string | number>, provider: string) => {
    setLoading(true)
    setError('')
    try {
      let resp: any
      if (provider === 'telegram') {
        resp = await authAPI.telegramAuth(data)
      } else {
        return
      }
      const { access_token, user } = resp.data
      localStorage.setItem('poker_token', access_token)
      localStorage.setItem('poker_user', JSON.stringify(user))
      window.location.href = '/app/trainer'
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : `Ошибка входа через ${provider}`)
    } finally {
      setLoading(false)
    }
  }

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!email.trim()) return setError('Введи email')
    setError(''); setLoading(true)
    try {
      const resp = await authAPI.sendCode(email.trim().toLowerCase())
      setIsNew(resp.data.is_new)
      setStep('code')
      setCode(['', '', '', '', '', ''])
      setResendTimer(60)
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Не удалось отправить код')
    } finally { setLoading(false) }
  }

  const handleCodeInput = (i: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...code]
    next[i] = digit
    setCode(next)
    setError('')
    if (digit && i < 5) inputRefs.current[i + 1]?.focus()
    if (next.every(d => d)) setTimeout(() => verifyCode(next.join('')), 50)
  }

  const handleCodeKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) inputRefs.current[i - 1]?.focus()
  }

  const handleCodePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) {
      setCode(text.split(''))
      inputRefs.current[5]?.focus()
      setTimeout(() => verifyCode(text), 50)
    }
  }

  const verifyCode = async (codeStr?: string) => {
    const fullCode = codeStr || code.join('')
    if (fullCode.length !== 6) return setError('Введи 6-значный код')
    if (isNew && !firstName.trim()) return setError('Введи своё имя')
    setError(''); setLoading(true)
    try {
      const resp = await authAPI.verifyCode(email, fullCode, isNew ? firstName.trim() : undefined)
      const { access_token, user } = resp.data
      localStorage.setItem('poker_token', access_token)
      localStorage.setItem('poker_user', JSON.stringify(user))
      window.location.href = '/app/trainer'
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Неверный код')
      setCode(['', '', '', '', '', ''])
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
    } finally { setLoading(false) }
  }

  const hasSocial = socialCfg && (socialCfg.google_enabled || socialCfg.telegram_bot_username)

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#070e07' }}>
      <motion.div className="fixed top-1/4 left-1/4 text-9xl select-none pointer-events-none"
        style={{ color: 'rgba(245,158,11,0.03)' }}
        animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 8, repeat: Infinity }}>
        ♠
      </motion.div>
      <motion.div className="fixed bottom-1/4 right-1/4 text-9xl select-none pointer-events-none"
        style={{ color: 'rgba(245,158,11,0.03)' }}
        animate={{ rotate: [0, -5, 5, 0] }} transition={{ duration: 10, repeat: Infinity, delay: 1 }}>
        ♣
      </motion.div>

      <div className="relative z-10 w-full max-w-sm">
        <button
          onClick={() => step === 'code' ? (setStep('email'), setCode(['','','','','',''])) : navigate('/')}
          className="flex items-center gap-2 text-sm mb-8 transition-colors"
          style={{ color: '#4a8a4a' }}>
          <ArrowLeft className="w-4 h-4" />
          {step === 'code' ? 'Другой email' : 'На главную'}
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
            {step === 'email' ? (
              <motion.div key="email" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }}
                className="space-y-4">

                {/* Social login buttons */}
                {hasSocial && (
                  <div className="space-y-3">
                    {socialCfg?.google_enabled && (
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

                    {socialCfg?.telegram_bot_username && !loading && (
                      <TelegramButton
                        botUsername={socialCfg.telegram_bot_username}
                        onAuth={data => handleSocialLogin(data, 'telegram')}
                      />
                    )}

                    {hasSocial && (
                      <div className="flex items-center gap-3 my-2">
                        <div className="flex-1 h-px" style={{ background: '#1a3a1a' }} />
                        <span className="text-xs" style={{ color: '#2d5a2d' }}>или войди по email</span>
                        <div className="flex-1 h-px" style={{ background: '#1a3a1a' }} />
                      </div>
                    )}
                  </div>
                )}

                <form onSubmit={sendCode} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#4a8a4a' }}>
                      Email
                    </label>
                    <input type="email" value={email}
                      onChange={e => { setEmail(e.target.value); setError('') }}
                      placeholder="poker@example.com" required autoFocus={!hasSocial}
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                      style={{ background: '#0d1d0d', border: '1px solid #1a3a1a', color: '#e5f5e5' }}
                      onFocus={e => (e.target.style.borderColor = 'rgba(74,222,128,0.4)')}
                      onBlur={e => (e.target.style.borderColor = '#1a3a1a')} />
                  </div>

                  {error && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="text-red-400 text-sm">{error}</motion.p>
                  )}

                  <button type="submit" disabled={loading || !email.trim()}
                    className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all text-white"
                    style={{ background: '#15803d', opacity: loading || !email.trim() ? 0.5 : 1 }}>
                    {loading
                      ? <><Loader className="w-4 h-4 animate-spin" />Отправляем...</>
                      : <><Mail className="w-4 h-4" />Получить код</>}
                  </button>
                </form>
              </motion.div>

            ) : (
              <motion.div key="code" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}
                className="space-y-5">

                <div className="text-center">
                  <p className="text-sm" style={{ color: '#4a8a4a' }}>Код отправлен на</p>
                  <p className="text-sm font-semibold text-white mt-0.5">{email}</p>
                </div>

                {isNew && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#4a8a4a' }}>
                      Твоё имя
                    </label>
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
                  <label className="block text-xs font-medium mb-3 text-center" style={{ color: '#4a8a4a' }}>
                    Введи код из письма
                  </label>
                  <div className="flex gap-2 justify-center" onPaste={handleCodePaste}>
                    {code.map((digit, i) => (
                      <input key={i} ref={el => { inputRefs.current[i] = el }}
                        type="text" inputMode="numeric" maxLength={1} value={digit}
                        onChange={e => handleCodeInput(i, e.target.value)}
                        onKeyDown={e => handleCodeKeyDown(i, e)}
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
                </div>

                {error && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-red-400 text-sm text-center">{error}</motion.p>
                )}

                <button onClick={() => verifyCode()}
                  disabled={loading || code.join('').length !== 6 || (isNew && !firstName.trim())}
                  className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 text-white transition-all"
                  style={{ background: '#15803d', opacity: loading || code.join('').length !== 6 ? 0.5 : 1 }}>
                  {loading ? <><Loader className="w-4 h-4 animate-spin" />Проверяем...</> : 'Войти'}
                </button>

                <button onClick={() => { if (resendTimer === 0) sendCode() }}
                  disabled={resendTimer > 0 || loading}
                  className="w-full py-2 text-sm flex items-center justify-center gap-1.5 transition-colors"
                  style={{ color: resendTimer > 0 ? '#2d5a2d' : '#4a8a4a' }}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  {resendTimer > 0 ? `Повторить через ${resendTimer}с` : 'Отправить новый код'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
