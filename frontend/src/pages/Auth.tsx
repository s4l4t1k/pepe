import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Loader, Mail, RefreshCw } from 'lucide-react'
import { authAPI } from '../api/client'

type Step = 'email' | 'code'

export default function Auth() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [isNew, setIsNew] = useState(false)
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    if (resendTimer <= 0) return
    const t = setTimeout(() => setResendTimer(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [resendTimer])

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
              <motion.form key="email" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }}
                onSubmit={sendCode} className="space-y-4">

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#4a8a4a' }}>
                    Email
                  </label>
                  <input type="email" value={email}
                    onChange={e => { setEmail(e.target.value); setError('') }}
                    placeholder="poker@example.com" required autoFocus
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
                  className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all mt-2 text-white"
                  style={{ background: '#15803d', opacity: loading || !email.trim() ? 0.5 : 1 }}>
                  {loading
                    ? <><Loader className="w-4 h-4 animate-spin" />Отправляем...</>
                    : <><Mail className="w-4 h-4" />Получить код</>}
                </button>
              </motion.form>

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
