import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
  timeout: 120000, // 2 minutes for AI responses
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: attach JWT token
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('poker_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor: handle 401
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('poker_token')
      localStorage.removeItem('poker_user')
      window.location.href = '/auth'
    }
    return Promise.reject(error)
  }
)

export default client

// ── API helpers ───────────────────────────────────────────────────────────────

export interface User {
  id: number
  email: string
  first_name: string
  experience_level: string | null
  play_style: string | null
  hands_analyzed_count: number
  daily_analyses_remaining: number
  daily_limit: number
  created_at: string
}

export interface AnalysisResult {
  preflop: string
  flop: string
  turn: string
  river: string
  main_leak: string
  recommended_line: string
  ev_estimate: string
  overall_score: string | null
  raw_response: string
}

export interface HandRecord {
  hand_id: number
  hand_text_preview: string
  analysis: AnalysisResult | null
  created_at: string
}

export interface LessonItem {
  lesson_id: string
  lesson_name: string
  completed: boolean
}

export interface ModuleItem {
  module_id: string
  module_name: string
  lessons: LessonItem[]
  completed_count: number
  total_count: number
}

export interface OpponentAnalysis {
  play_style: string
  vpip_estimate: string
  aggression: string
  tendencies: string[]
  weaknesses: string[]
  how_to_exploit: string
  overall_threat: string
}

export interface Opponent {
  id: number
  nickname: string
  notes: string[]
  analysis: OpponentAnalysis | null
  hands_count: number
  created_at: string
  updated_at: string
}

export interface LessonContent {
  title: string
  introduction: string
  theory: string
  key_concepts: string[]
  practical_tips: string[]
  quiz_question: string
  quiz_options: string[]
  quiz_correct: string
  quiz_explanation: string
}

// Auth
export const authAPI = {
  sendCode: (email: string) =>
    client.post<{ ok: boolean; is_new: boolean }>('/auth/send-code', { email }),
  verifyCode: (email: string, code: string, first_name?: string) =>
    client.post('/auth/verify-code', { email, code, first_name }),
  // Legacy
  register: (email: string, password: string, first_name: string) =>
    client.post('/auth/register', { email, password, first_name }),
  login: (email: string, password: string) =>
    client.post('/auth/login', { email, password }),
  me: () => client.get('/auth/me'),
  updateProfile: (data: { experience_level?: string; play_style?: string; first_name?: string }) =>
    client.put('/auth/profile', data),
}

// Web app features
export const webAPI = {
  analyzeHand: (hand_text: string) =>
    client.post('/web/analyze/hand', { hand_text }),
  analyzeScreenshot: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return client.post('/web/analyze/screenshot', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  askAssistant: (question: string, history?: Array<{ role: string; content: string }>) =>
    client.post('/web/assistant', { question, history }),
  getModules: () => client.get<ModuleItem[]>('/web/training/modules'),
  getLessonContent: (lesson_id: string) =>
    client.post(`/web/training/lesson/${lesson_id}`, {}),
  completeLesson: (lesson_id: string) =>
    client.post(`/web/training/complete/${lesson_id}`, {}),
  getHistory: () => client.get<HandRecord[]>('/web/history'),
  getProfile: () => client.get('/web/profile'),
  // Opponents
  createOpponent: (nickname: string) =>
    client.post<Opponent>('/web/opponents', { nickname }),
  listOpponents: () => client.get<Opponent[]>('/web/opponents'),
  getOpponent: (id: number) => client.get<Opponent>(`/web/opponents/${id}`),
  addOpponentNote: (id: number, note: string) =>
    client.post<Opponent>(`/web/opponents/${id}/note`, { note }),
  analyzeOpponent: (id: number) =>
    client.post<Opponent>(`/web/opponents/${id}/analyze`, {}),
  deleteOpponent: (id: number) => client.delete(`/web/opponents/${id}`),
}
