import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronLeft,
  Loader,
  AlertCircle,
  Trophy,
  Lightbulb,
  Target,
  Brain,
} from 'lucide-react'
import { webAPI, ModuleItem, LessonContent } from '../api/client'

const moduleIcons = ['📚', '🎯', '🔥', '💰']
const moduleColors = [
  { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', active: 'border-blue-500/50 bg-blue-500/15' },
  { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', active: 'border-purple-500/50 bg-purple-500/15' },
  { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400', active: 'border-orange-500/50 bg-orange-500/15' },
  { bg: 'bg-poker-success/10', border: 'border-poker-success/20', text: 'text-poker-success', active: 'border-poker-success/50 bg-poker-success/15' },
]

export default function Training() {
  const [modules, setModules] = useState<ModuleItem[]>([])
  const [loadingModules, setLoadingModules] = useState(true)
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null)
  const [lessonContent, setLessonContent] = useState<LessonContent | null>(null)
  const [loadingLesson, setLoadingLesson] = useState(false)
  const [completingLesson, setCompletingLesson] = useState(false)
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadModules()
  }, [])

  const loadModules = async () => {
    try {
      const resp = await webAPI.getModules()
      setModules(resp.data)
    } catch {
      setError('Не удалось загрузить модули')
    } finally {
      setLoadingModules(false)
    }
  }

  const openLesson = async (lessonId: string) => {
    setSelectedLesson(lessonId)
    setLessonContent(null)
    setQuizAnswer(null)
    setLoadingLesson(true)
    setError('')

    try {
      const resp = await webAPI.getLessonContent(lessonId)
      setLessonContent(resp.data.content)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Не удалось загрузить урок')
    } finally {
      setLoadingLesson(false)
    }
  }

  const completeLesson = async () => {
    if (!selectedLesson) return
    setCompletingLesson(true)
    try {
      await webAPI.completeLesson(selectedLesson)
      // Update modules state
      setModules((prev) =>
        prev.map((mod) => ({
          ...mod,
          lessons: mod.lessons.map((l) =>
            l.lesson_id === selectedLesson ? { ...l, completed: true } : l
          ),
          completed_count: mod.lessons.some((l) => l.lesson_id === selectedLesson)
            ? mod.completed_count + (mod.lessons.find((l) => l.lesson_id === selectedLesson)?.completed ? 0 : 1)
            : mod.completed_count,
        }))
      )
      setSelectedLesson(null)
      setLessonContent(null)
    } catch {
      // ignore
    } finally {
      setCompletingLesson(false)
    }
  }

  const totalLessons = modules.reduce((sum, m) => sum + m.total_count, 0)
  const completedLessons = modules.reduce((sum, m) => sum + m.completed_count, 0)
  const progress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0

  const currentLessonName = modules
    .flatMap((m) => m.lessons)
    .find((l) => l.lesson_id === selectedLesson)?.lesson_name || ''

  if (selectedLesson) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <button
            onClick={() => { setSelectedLesson(null); setLessonContent(null); setError('') }}
            className="flex items-center gap-2 text-poker-text-muted hover:text-poker-text transition-colors mb-6 text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            К модулям
          </button>

          {loadingLesson && (
            <div className="text-center py-20">
              <Loader className="w-8 h-8 text-poker-primary animate-spin mx-auto mb-4" />
              <p className="text-poker-text-muted">Генерирую урок...</p>
              <p className="text-poker-text-muted text-sm mt-2 opacity-60">AI создаёт персональный контент</p>
            </div>
          )}

          {error && !loadingLesson && (
            <div className="p-4 bg-poker-danger/10 border border-poker-danger/30 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {lessonContent && !loadingLesson && (
            <div>
              {/* Title */}
              <div className="card mb-6">
                <h2 className="text-xl font-bold mb-2">{lessonContent.title}</h2>
                <p className="text-poker-text-muted text-sm leading-relaxed">{lessonContent.introduction}</p>
              </div>

              {/* Theory */}
              <div className="card mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="w-5 h-5 text-blue-400" />
                  <h3 className="font-semibold text-blue-400">Теория</h3>
                </div>
                <p className="text-poker-text text-sm leading-relaxed whitespace-pre-wrap">{lessonContent.theory}</p>
              </div>

              {/* Key concepts */}
              {lessonContent.key_concepts?.length > 0 && (
                <div className="card mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="w-5 h-5 text-poker-primary" />
                    <h3 className="font-semibold text-poker-primary">Ключевые концепции</h3>
                  </div>
                  <ul className="space-y-2">
                    {lessonContent.key_concepts.map((concept, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-poker-text">
                        <span className="text-poker-primary mt-0.5 flex-shrink-0">→</span>
                        <span>{concept}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Practical tips */}
              {lessonContent.practical_tips?.length > 0 && (
                <div className="card mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="w-5 h-5 text-poker-success" />
                    <h3 className="font-semibold text-poker-success">Практические советы</h3>
                  </div>
                  <ul className="space-y-2">
                    {lessonContent.practical_tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-poker-text">
                        <span className="text-poker-success mt-0.5 flex-shrink-0">✓</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quiz */}
              {lessonContent.quiz_question && (
                <div className="card mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-5 h-5 text-poker-primary" />
                    <h3 className="font-semibold text-poker-primary">Квиз</h3>
                  </div>
                  <p className="text-sm font-medium mb-4 text-poker-text">{lessonContent.quiz_question}</p>
                  <div className="space-y-2">
                    {lessonContent.quiz_options?.map((option, i) => {
                      const letter = String.fromCharCode(65 + i) // A, B, C, D
                      const isCorrect = letter === lessonContent.quiz_correct
                      const isSelected = quizAnswer === letter
                      const showResult = quizAnswer !== null

                      return (
                        <motion.button
                          key={i}
                          whileTap={!quizAnswer ? { scale: 0.99 } : {}}
                          onClick={() => !quizAnswer && setQuizAnswer(letter)}
                          disabled={!!quizAnswer}
                          className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all duration-200 ${
                            showResult && isCorrect
                              ? 'bg-poker-success/20 border-poker-success/40 text-poker-success'
                              : showResult && isSelected && !isCorrect
                              ? 'bg-poker-danger/20 border-poker-danger/40 text-red-400'
                              : !quizAnswer
                              ? 'bg-poker-secondary border-poker-border hover:border-poker-primary text-poker-text'
                              : 'bg-poker-secondary border-poker-border text-poker-text-muted opacity-50'
                          }`}
                        >
                          {option}
                        </motion.button>
                      )
                    })}
                  </div>

                  {quizAnswer && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`mt-4 p-4 rounded-lg text-sm ${
                        quizAnswer === lessonContent.quiz_correct
                          ? 'bg-poker-success/10 border border-poker-success/30 text-poker-success'
                          : 'bg-poker-danger/10 border border-poker-danger/30 text-red-400'
                      }`}
                    >
                      <p className="font-semibold mb-1">
                        {quizAnswer === lessonContent.quiz_correct ? '✅ Правильно!' : '❌ Неверно'}
                      </p>
                      <p className="text-poker-text text-sm">{lessonContent.quiz_explanation}</p>
                    </motion.div>
                  )}
                </div>
              )}

              {/* Complete button */}
              <button
                onClick={completeLesson}
                disabled={completingLesson}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {completingLesson ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Сохраняю...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Урок пройден
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold mb-2">Обучение</h1>
        <p className="text-poker-text-muted mb-6">4 модуля, 15 уроков с квизами и AI-объяснениями</p>

        {/* Progress bar */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Общий прогресс</span>
            <span className="text-sm text-poker-primary font-semibold">{completedLessons}/{totalLessons}</span>
          </div>
          <div className="w-full bg-poker-secondary rounded-full h-3">
            <motion.div
              className="bg-poker-primary h-3 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <p className="text-poker-text-muted text-xs mt-2">
            {Math.round(progress)}% завершено
          </p>
        </div>

        {loadingModules ? (
          <div className="text-center py-16">
            <Loader className="w-8 h-8 text-poker-primary animate-spin mx-auto mb-3" />
            <p className="text-poker-text-muted">Загружаю модули...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-poker-danger/10 border border-poker-danger/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        ) : (
          <div className="space-y-4">
            {modules.map((mod, modIndex) => {
              const colors = moduleColors[modIndex] || moduleColors[0]
              const icon = moduleIcons[modIndex] || '📖'
              const modProgress = mod.total_count > 0 ? (mod.completed_count / mod.total_count) * 100 : 0

              return (
                <motion.div
                  key={mod.module_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: modIndex * 0.1 }}
                  className={`border rounded-xl overflow-hidden ${colors.border} ${colors.bg}`}
                >
                  {/* Module header */}
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{icon}</span>
                        <div>
                          <h3 className={`font-semibold ${colors.text}`}>{mod.module_name}</h3>
                          <p className="text-poker-text-muted text-xs mt-0.5">
                            {mod.completed_count}/{mod.total_count} уроков
                          </p>
                        </div>
                      </div>
                      {mod.completed_count === mod.total_count && mod.total_count > 0 && (
                        <span className="text-poker-success text-sm font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          Завершён
                        </span>
                      )}
                    </div>

                    {/* Module progress bar */}
                    <div className="w-full bg-poker-bg/50 rounded-full h-1.5">
                      <motion.div
                        className={`h-1.5 rounded-full bg-current ${colors.text}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${modProgress}%` }}
                        transition={{ duration: 0.6, delay: modIndex * 0.1 }}
                      />
                    </div>
                  </div>

                  {/* Lessons */}
                  <div className="border-t border-poker-border/50 divide-y divide-poker-border/30">
                    {mod.lessons.map((lesson) => (
                      <button
                        key={lesson.lesson_id}
                        onClick={() => openLesson(lesson.lesson_id)}
                        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-poker-bg/30 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          {lesson.completed ? (
                            <CheckCircle2 className="w-4 h-4 text-poker-success flex-shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-poker-text-muted flex-shrink-0" />
                          )}
                          <span className={`text-sm ${lesson.completed ? 'text-poker-text-muted' : 'text-poker-text'}`}>
                            {lesson.lesson_name}
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-poker-text-muted flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>
    </div>
  )
}
