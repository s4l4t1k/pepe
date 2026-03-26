import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Zap, History, Users, User, LogOut, Menu, X, Swords } from 'lucide-react'
import { useAuth } from '../store/auth'

const NAV = [
  { path: '/app/trainer', icon: Zap, label: 'AI Тренер' },
  { path: '/app/practice', icon: Swords, label: 'Практика' },
  { path: '/app/history', icon: History, label: 'История' },
  { path: '/app/opponents', icon: Users, label: 'Оппоненты' },
  { path: '/app/profile', icon: User, label: 'Профиль' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/') }

  return (
    <div className="flex h-screen overflow-hidden bg-[#070e07]">
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-20 lg:hidden" onClick={() => setOpen(false)} />
        )}
      </AnimatePresence>

      <aside className={`fixed lg:relative top-0 left-0 h-full w-56 bg-[#0c1a0c] border-r border-[#1a3a1a] flex flex-col z-30 transition-transform duration-250 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-5 py-5 border-b border-[#1a3a1a] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-500/15 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">Poker Coach</p>
              <p className="text-[10px] text-[#2d5a2d] mt-0.5">AI Тренер</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden text-[#2d5a2d] hover:text-green-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(({ path, icon: Icon, label }) => (
            <NavLink key={path} to={path} onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-green-900/30 text-green-400 border border-green-700/20'
                    : 'text-[#4a8a4a] hover:text-green-200 hover:bg-[#1a3a1a] border border-transparent'
                }`
              }>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-[#1a3a1a]">
          <div className="flex items-center gap-2.5 mb-2 px-1">
            <div className="w-7 h-7 bg-[#1a3a1a] rounded-full flex items-center justify-center border border-[#2a5a2a] flex-shrink-0">
              <span className="text-amber-500 text-xs font-bold">{user?.first_name?.charAt(0).toUpperCase() || '?'}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-green-100 truncate">{user?.first_name}</p>
              <p className="text-[10px] text-[#2d5a2d] truncate">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 text-[#2d5a2d] hover:text-red-400 transition-colors text-xs w-full px-2 py-1.5 rounded-lg hover:bg-red-950/20">
            <LogOut className="w-3.5 h-3.5" />
            Выйти
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#0c1a0c] border-b border-[#1a3a1a]">
          <button onClick={() => setOpen(true)} className="p-1.5 text-[#4a8a4a] hover:text-green-300">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-bold text-white">Poker Coach</span>
          </div>
          <div className="w-7 h-7 bg-[#1a3a1a] rounded-full flex items-center justify-center border border-[#2a5a2a]">
            <span className="text-amber-500 text-xs font-bold">{user?.first_name?.charAt(0).toUpperCase() || '?'}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
