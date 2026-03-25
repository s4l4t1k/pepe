import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Zap, History, Users, User, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '../store/auth'

const NAV = [
  { path: '/app/trainer', icon: Zap, label: 'AI Тренер' },
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
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* Mobile overlay */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-20 lg:hidden" onClick={() => setOpen(false)} />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`fixed lg:relative top-0 left-0 h-full w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col z-30 transition-transform duration-250 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-500/15 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-100 leading-none">Poker Coach</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">AI Тренер</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden text-zinc-600 hover:text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(({ path, icon: Icon, label }) => (
            <NavLink key={path} to={path} onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'
                }`
              }>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-zinc-800">
          <div className="flex items-center gap-2.5 mb-2 px-1">
            <div className="w-7 h-7 bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-700 flex-shrink-0">
              <span className="text-amber-500 text-xs font-bold">{user?.first_name?.charAt(0).toUpperCase() || '?'}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-200 truncate">{user?.first_name}</p>
              <p className="text-[10px] text-zinc-600 truncate">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 text-zinc-600 hover:text-red-400 transition-colors text-xs w-full px-2 py-1.5 rounded-lg hover:bg-red-950/20">
            <LogOut className="w-3.5 h-3.5" />
            Выйти
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
          <button onClick={() => setOpen(true)} className="p-1.5 text-zinc-500 hover:text-zinc-300">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-bold text-zinc-100">Poker Coach</span>
          </div>
          <div className="w-7 h-7 bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-700">
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
