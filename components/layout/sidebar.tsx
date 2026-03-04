'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, FolderKanban, Users, FileText, Settings,
  CheckSquare, Film, Package, Camera, RotateCcw, HardDrive, Mail, ChevronLeft,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects',  label: 'Projects',  icon: FolderKanban },
  { href: '/contacts',  label: 'Contacts',  icon: Users },
  { href: '/invoices',  label: 'Invoices',  icon: FileText },
  { href: '/settings',  label: 'Settings',  icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  // Detect project sub-pages: /projects/{id} or /projects/{id}/{subpage}
  const parts = pathname.split('/')
  const projectId =
    parts[1] === 'projects' && parts[2] && parts[2] !== 'new'
      ? parts[2]
      : null

  const projectNavItems = projectId ? [
    { href: `/projects/${projectId}`,             label: 'Project',       icon: ChevronLeft },
    { href: `/projects/${projectId}/todo`,         label: 'To Do',         icon: CheckSquare },
    { href: `/projects/${projectId}/frameio`,      label: 'Frame.io',      icon: Film },
    { href: `/projects/${projectId}/deliverables`, label: 'Deliverables',  icon: Package },
    { href: `/projects/${projectId}/shoots`,       label: 'Shoot Details', icon: Camera },
    { href: `/projects/${projectId}/revisions`,    label: 'Revisions',     icon: RotateCcw },
  ] : []

  const projectToolItems = projectId ? [
    { href: `/projects/${projectId}/footage`, label: 'Manage Assets', icon: HardDrive },
    { href: `/projects/${projectId}/emails`,  label: 'Emails',        icon: Mail },
  ] : []

  function isSubActive(href: string) {
    // Exact match for the project root, prefix match for sub-pages
    if (href === `/projects/${projectId}`) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className="w-60 shrink-0 bg-[#1e3a5f] min-h-screen flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <h1 className="text-white font-bold text-xl tracking-wide">Ambient Arts</h1>
        <p className="text-white/50 text-xs mt-0.5">Project Manager</p>
      </div>

      {/* Main navigation */}
      <nav className="p-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
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
            </Link>
          )
        })}
      </nav>

      {/* Project sub-navigation */}
      {projectId && (
        <div className="px-3 pb-3">
          <div className="border-t border-white/10 pt-3 space-y-0.5">
            {projectNavItems.map(({ href, label, icon: Icon }) => {
              const active = isSubActive(href)
              const isBack = href === `/projects/${projectId}`
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors',
                    active
                      ? 'bg-white/15 text-white'
                      : isBack
                        ? 'text-white/50 hover:bg-white/10 hover:text-white/80'
                        : 'text-white/65 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              )
            })}

            <div className="border-t border-white/10 my-1.5" />

            {projectToolItems.map(({ href, label, icon: Icon }) => {
              const active = isSubActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors',
                    active
                      ? 'bg-white/15 text-white'
                      : 'text-white/65 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/10">
        <p className="text-white/30 text-xs">v1.0 · February 2026</p>
      </div>
    </aside>
  )
}
