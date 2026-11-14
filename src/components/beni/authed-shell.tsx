import { Link, useRouterState } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { Home, HeartHandshake, CalendarDays, Stethoscope, Activity, Settings, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Brand } from './shell';

const NAV = [
  { to: '/dashboard', label: 'home', icon: Home },
  { to: '/benefits', label: 'my benefits', icon: HeartHandshake },
  { to: '/calendar', label: 'my calendar', icon: CalendarDays },
  { to: '/care', label: 'my care', icon: Stethoscope },
  { to: '/activity', label: 'activity', icon: Activity },
  { to: '/settings', label: 'settings', icon: Settings },
] as const;

export function AuthedShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (to: string) => path === to;

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-border/60 bg-secondary/40 sticky top-0 h-screen shrink-0 transition-[width] duration-200 ${collapsed ? 'w-16' : 'w-56'}`}
        aria-label="Main navigation"
      >
        <div className={`flex items-center h-20 ${collapsed ? 'justify-center' : 'justify-between px-5'}`}>
          {!collapsed && <Brand />}
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <nav className="flex-1 flex flex-col gap-1 px-2 mt-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              aria-current={isActive(to) ? 'page' : undefined}
              title={label}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                isActive(to) ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t border-border/60">
          <button
            onClick={() => supabase.auth.signOut()}
            title="Sign out"
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground w-full ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut size={18} className="shrink-0" />
            {!collapsed && <span>sign out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-b border-border/60">
        <div className="flex h-14 items-center justify-center">
          <Brand />
        </div>
      </div>

      <div className="flex-1 min-w-0 pt-14 md:pt-0 pb-20 md:pb-0">{children}</div>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border/60 flex justify-around py-2"
        aria-label="Main navigation"
      >
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            aria-label={label}
            aria-current={isActive(to) ? 'page' : undefined}
            className={`flex flex-col items-center gap-1 px-2 py-1 text-[10px] ${isActive(to) ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
