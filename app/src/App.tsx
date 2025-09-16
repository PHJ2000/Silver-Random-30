import { useEffect, type ReactNode } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { HomePage } from './pages/HomePage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { MiniTimerPage } from './pages/MiniTimerPage'
import { useSettingsStore } from './store/settings'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Seoul')

type Theme = 'system' | 'light' | 'dark'

function applyTheme(theme: Theme) {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const useDark = theme === 'dark' || (theme === 'system' && prefersDark)
  root.classList.toggle('dark', useDark)
}

function Layout({ children }: { children: ReactNode }) {
  const theme = useSettingsStore((state) => state.settings.theme)

  useEffect(() => {
    if (typeof window === 'undefined') return
    applyTheme(theme)
    if (theme === 'system') {
      const listener = (event: MediaQueryListEvent) => applyTheme(event.matches ? 'dark' : 'light')
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      media.addEventListener('change', listener)
      return () => media.removeEventListener('change', listener)
    }
  }, [theme])

  return (
    <div className="min-h-screen bg-slate-100 pb-16 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="text-xl font-bold text-brand-600 dark:text-brand-300">
            실랜디 30
          </Link>
          <nav className="flex gap-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive
                  ? 'text-brand-600 dark:text-brand-300'
                  : 'hover:text-brand-600 dark:hover:text-brand-200'
              }
            >
              홈
            </NavLink>
            <NavLink
              to="/leaderboard"
              className={({ isActive }) =>
                isActive
                  ? 'text-brand-600 dark:text-brand-300'
                  : 'hover:text-brand-600 dark:hover:text-brand-200'
              }
            >
              주간 랭킹
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto mt-8 w-full max-w-6xl px-4 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Layout>
            <HomePage />
          </Layout>
        }
      />
      <Route
        path="/leaderboard"
        element={
          <Layout>
            <LeaderboardPage />
          </Layout>
        }
      />
      <Route path="/mini" element={<MiniTimerPage />} />
    </Routes>
  )
}
