'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, FolderKanban, Users, FileText, Settings } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects',  label: 'Projects',  icon: FolderKanban },
  { href: '/contacts',  label: 'Contacts',  icon: Users },
  { href: '/invoices',  label: 'Invoices',  icon: FileText },
  { href: '/settings',  label: 'Settings',  icon: Settings },
]

export function Sidebar({ frameioBadge }: { frameioBadge?: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <aside className="w-60 shrink-0 bg-[#1e3a5f] min-h-screen flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <h1 className="text-white font-bold text-xl tracking-wide">Ambient Arts</h1>
        <p className="text-white/50 text-xs mt-0.5">Project Manager</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          const isProjects = href === '/projects'
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                active
                  ? 'bg-white/15 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon size={18} />
              {label}
              {isProjects && frameioBadge}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/10">
        <p className="text-white/30 text-xs">v1.0 · February 2026</p>
      </div>
    </aside>
  )
}
