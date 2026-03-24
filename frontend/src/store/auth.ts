import { createContext, useContext, useState, useEffect, ReactNode, createElement } from 'react'
import { authAPI, User } from '../api/client'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, first_name: string) => Promise<void>
  logout: () => void
  updateUser: (user: User) => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('poker_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('poker_token')
  )
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const storedToken = localStorage.getItem('poker_token')
      if (storedToken) {
        try {
          const resp = await authAPI.me()
          setUser(resp.data)
          localStorage.setItem('poker_user', JSON.stringify(resp.data))
        } catch {
          localStorage.removeItem('poker_token')
          localStorage.removeItem('poker_user')
          setToken(null)
          setUser(null)
        }
      }
      setIsLoading(false)
    }
    init()
  }, [])

  const login = async (email: string, password: string) => {
    const resp = await authAPI.login(email, password)
    const { access_token, user: userData } = resp.data
    localStorage.setItem('poker_token', access_token)
    localStorage.setItem('poker_user', JSON.stringify(userData))
    setToken(access_token)
    setUser(userData)
  }

  const register = async (email: string, password: string, first_name: string) => {
    const resp = await authAPI.register(email, password, first_name)
    const { access_token, user: userData } = resp.data
    localStorage.setItem('poker_token', access_token)
    localStorage.setItem('poker_user', JSON.stringify(userData))
    setToken(access_token)
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('poker_token')
    localStorage.removeItem('poker_user')
    setToken(null)
    setUser(null)
  }

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser)
    localStorage.setItem('poker_user', JSON.stringify(updatedUser))
  }

  const refreshUser = async () => {
    try {
      const resp = await authAPI.me()
      setUser(resp.data)
      localStorage.setItem('poker_user', JSON.stringify(resp.data))
    } catch {
      // ignore
    }
  }

  return createElement(
    AuthContext.Provider,
    {
      value: {
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        register,
        logout,
        updateUser,
        refreshUser,
      },
    },
    children
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
