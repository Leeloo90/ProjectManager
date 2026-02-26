'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate, getStatusBadgeClass, getStatusConfig, ACTIVE_STATUSES, PROJECT_STATUSES } from '@/lib/utils'
import { format } from 'date-fns'
import { ChevronRight, AlertTriangle } from 'lucide-react'

type Project = {
  id: string; name: string; status: string; startDate: string; deadline: string;
  clientName: string | null; companyName: string | null; invoiceId: string | null;
  createdAt: string | null;
}

const ALL_STATUSES = ['all', ...PROJECT_STATUSES.map(s => s.key)] as const

export function ProjectsClient({ projects, projectCosts }: {
  projects: Project[]
  projectCosts: Record<string, number>
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const today = format(new Date(), 'yyyy-MM-dd')

  const filtered = projects.filter(p => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.clientName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.companyName ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    return matchSearch && matchStatus
  })

  const statusCounts = PROJECT_STATUSES.reduce((acc, s) => {
    acc[s.key] = projects.filter(p => p.status === s.key).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Filters */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex gap-3 flex-wrap items-center">
          <Input
            placeholder="Search projects, clients, companies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === 'all' ? 'bg-[#1e3a5f] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            All ({projects.length})
          </button>
          {PROJECT_STATUSES.map(s => (
            statusCounts[s.key] > 0 && (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === s.key ? 'bg-[#1e3a5f] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {s.label} ({statusCounts[s.key]})
              </button>
            )
          ))}
        </div>
      </div>

      {/* Projects table */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-gray-400 text-sm">
          {projects.length === 0 ? 'No projects yet. Click "New Project" to get started.' : 'No projects match your filters.'}
        </Card>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Project</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Deadline</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Company</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Value</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(p => {
                const isOverdue = ACTIVE_STATUSES.includes(p.status as any) && p.deadline < today
                return (
                  <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${isOverdue ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isOverdue && <AlertTriangle size={14} className="text-red-500 shrink-0" />}
                        <Link href={`/projects/${p.id}`} className="font-medium text-gray-900 hover:text-blue-600 transition-colors">
                          {p.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.clientName}</td>
                    <td className="px-4 py-3">
                      <Badge className={getStatusBadgeClass(p.status)}>
                        {getStatusConfig(p.status).label}
                      </Badge>
                    </td>
                    <td className={`px-4 py-3 text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                      {formatDate(p.deadline)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.companyName}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                      {projectCosts[p.id] ? formatCurrency(projectCosts[p.id]) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/projects/${p.id}`}>
                        <Button size="icon" variant="ghost">
                          <ChevronRight size={16} />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
