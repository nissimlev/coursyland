import { NavLink, Outlet } from 'react-router-dom';
import { ChartIcon, ClipboardIcon, HomeIcon, RepeatIcon } from '../components/ui/Icons';
import { ThemeToggle } from '../components/ui/ThemeToggle';

const NAV = [
  { to: '/', label: 'בית', Icon: HomeIcon, end: true },
  { to: '/simulation', label: 'סימולציה', Icon: ClipboardIcon },
  { to: '/mistakes', label: 'טעויות', Icon: RepeatIcon },
  { to: '/progress', label: 'התקדמות', Icon: ChartIcon },
];

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4">
          <NavLink to="/" className="flex items-center gap-2 font-extrabold tracking-tight">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-lg text-white shadow-sm">
              ✓
            </span>
            <span className="text-lg">מתאמנים לדפ״ר</span>
          </NavLink>
          <nav className="ms-6 hidden items-center gap-1 md:flex" aria-label="ניווט ראשי">
            {NAV.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ms-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 md:pb-12">
        <Outlet />
      </main>

      {/* ניווט תחתון במובייל */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-950/95"
        aria-label="ניווט ראשי"
      >
        <div className="grid grid-cols-4">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold ${
                  isActive ? 'text-violet-700 dark:text-violet-300' : 'text-slate-500 dark:text-slate-400'
                }`
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
