import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Search,
  BookOpen,
  MessageSquare,
  History,
  User,
  Users,
  LogOut,
  Menu,
  X,
  Spade,
} from 'lucide-react'
import { useAuth } from '../store/auth'

const navItems = [
  { path: '/app/dashboard', icon: LayoutDashboard, label: 'Главная', tip: 'Статистика и быстрый доступ к функциям' },
  { path: '/app/analyze', icon: Search, label: 'Анализ', tip: 'Анализ раздач — вставь текст или загрузи скриншот' },
  { path: '/app/training', icon: BookOpen, label: 'Обучение', tip: 'Уроки по стратегии с тестами' },
  { path: '/app/assistant', icon: MessageSquare, label: 'AI Тренер', tip: 'Задай любой вопрос по покеру' },
  { path: '/app/history', icon: History, label: 'История', tip: 'Последние 20 проанализированных раздач' },
  { path: '/app/opponents', icon: Users, label: 'Оппоненты', tip: 'Профили и анализ стиля игры оппонентов' },
  { path: '/app/profile', icon: User, label: 'Профиль', tip: 'Настройки профиля и уровень опыта' },
]

const experienceLabels: Record<string, string> = {
  beginner: 'Новичок',
  amateur: 'Любитель',
  semipro: 'Полурег',
  pro: 'Регуляр',
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const levelBadge = user?.experience_level ? (
    <span className="text-xs bg-poker-primary/20 text-poker-primary border border-poker-primary/30 px-2 py-0.5 rounded-full">
      {experienceLabels[user.experience_level] || user.experience_level}
    </span>
  ) : null

  return (
    <div className="flex h-screen bg-poker-bg overflow-hidden">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={`fixed lg:relative top-0 left-0 h-full w-64 bg-poker-card border-r border-poker-border flex flex-col z-30 transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-poker-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-poker-primary/20 rounded-xl flex items-center justify-center">
              <Spade className="w-6 h-6 text-poker-primary" />
            </div>
            <div>
              <h1 className="font-bold text-poker-primary text-lg leading-tight">Poker Coach</h1>
              <p className="text-poker-text-muted text-xs">AI Тренер</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ path, icon: Icon, label, tip }) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => setSidebarOpen(false)}
              title={tip}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-poker-primary/20 text-poker-primary border border-poker-primary/30'
                    : 'text-poker-text-muted hover:bg-poker-secondary hover:text-poker-text'
                }`
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User info & logout */}
        <div className="p-4 border-t border-poker-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-poker-secondary rounded-full flex items-center justify-center border border-poker-border">
              <span className="text-poker-primary font-semibold text-sm">
                {user?.first_name?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{user?.first_name}</p>
              <p className="text-poker-text-muted text-xs truncate">{user?.email}</p>
            </div>
          </div>
          {levelBadge && <div className="mb-3">{levelBadge}</div>}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-poker-text-muted hover:text-poker-danger transition-colors text-sm w-full px-2 py-1.5 rounded-lg hover:bg-poker-danger/10"
          >
            <LogOut className="w-4 h-4" />
            Выйти
          </button>
        </div>
      </motion.aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-poker-card border-b border-poker-border z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-poker-text-muted hover:text-poker-text hover:bg-poker-secondary"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Spade className="w-5 h-5 text-poker-primary" />
            <span className="font-bold text-poker-primary">Poker Coach AI</span>
          </div>
          <div className="w-9 h-9 bg-poker-secondary rounded-full flex items-center justify-center border border-poker-border">
            <span className="text-poker-primary font-semibold text-sm">
              {user?.first_name?.charAt(0).toUpperCase() || '?'}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={window.location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="min-h-full"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
