import { db } from '@/lib/db'
import { projects, invoices, deliverables, shootDetails, activityLog, clients, productionCompanies } from '@/lib/db/schema'
import { eq, and, ne, or, inArray, sql, desc, gte, lte } from 'drizzle-orm'
import { Topbar } from '@/components/layout/topbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate, getStatusBadgeClass, getStatusConfig, ACTIVE_STATUSES } from '@/lib/utils'
import { DashboardChart } from './chart'
import Link from 'next/link'
import { AlertTriangle, Clock, FileText, TrendingUp, DollarSign, Calendar } from 'lucide-react'
import { format, isAfter, isBefore, addDays, startOfMonth, endOfMonth, parseISO } from 'date-fns'

async function getDashboardData() {
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const in7days = format(addDays(today, 7), 'yyyy-MM-dd')
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd')

  // Financial year (March–Feb)
  const month = today.getMonth() + 1
  const year = today.getFullYear()
  const fyStart = month >= 3
    ? format(new Date(year, 2, 1), 'yyyy-MM-dd')
    : format(new Date(year - 1, 2, 1), 'yyyy-MM-dd')

  const allProjects = await db.select({
    id: projects.id,
    name: projects.name,
    status: projects.status,
    deadline: projects.deadline,
    clientId: projects.clientId,
    productionCompanyId: projects.productionCompanyId,
    invoiceId: projects.invoiceId,
  }).from(projects).all()

  const allInvoices = await db.select().from(invoices).all()

  // Summary stats
  const activeProjects = allProjects.filter(p =>
    ACTIVE_STATUSES.includes(p.status as typeof ACTIVE_STATUSES[number])
  )

  const overdueProjects = activeProjects.filter(p => p.deadline < todayStr)

  const awaitingInvoice = allProjects.filter(p => p.status === 'finished')

  const outstanding = allInvoices
    .filter(i => i.status === 'sent')
    .reduce((sum, i) => sum + i.total, 0)

  const monthRevenue = allInvoices
    .filter(i => i.status === 'paid' && i.paymentDate && i.paymentDate >= monthStart && i.paymentDate <= monthEnd)
    .reduce((sum, i) => sum + i.total, 0)

  const ytdRevenue = allInvoices
    .filter(i => i.status === 'paid' && i.paymentDate && i.paymentDate >= fyStart)
    .reduce((sum, i) => sum + i.total, 0)

  // Upcoming deadlines
  const upcomingDeadlines = await db.select({
    id: projects.id,
    name: projects.name,
    status: projects.status,
    deadline: projects.deadline,
    clientName: clients.name,
    companyName: productionCompanies.name,
  })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .leftJoin(productionCompanies, eq(projects.productionCompanyId, productionCompanies.id))
    .where(
      and(
        inArray(projects.status, [...ACTIVE_STATUSES])
      )
    )
    .orderBy(projects.deadline)
    .limit(10)
    .all()

  // Recent activity
  const recentActivity = await db.select().from(activityLog)
    .orderBy(desc(activityLog.createdAt))
    .limit(20)
    .all()

  // Uninvoiced projects grouped
  const uninvoiced = await db.select({
    id: projects.id,
    name: projects.name,
    companyName: productionCompanies.name,
    productionCompanyId: projects.productionCompanyId,
  })
    .from(projects)
    .leftJoin(productionCompanies, eq(projects.productionCompanyId, productionCompanies.id))
    .where(eq(projects.status, 'finished'))
    .all()

  // Revenue chart — last 12 months
  const chartData: { month: string; revenue: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const start = format(d, 'yyyy-MM-01')
    const end = format(new Date(d.getFullYear(), d.getMonth() + 1, 0), 'yyyy-MM-dd')
    const label = format(d, 'MMM yy')
    const rev = allInvoices
      .filter(inv => inv.status === 'paid' && inv.paymentDate && inv.paymentDate >= start && inv.paymentDate <= end)
      .reduce((sum, inv) => sum + inv.total, 0)
    chartData.push({ month: label, revenue: rev })
  }

  return {
    activeCount: activeProjects.length,
    overdueCount: overdueProjects.length,
    awaitingInvoiceCount: awaitingInvoice.length,
    outstanding,
    monthRevenue,
    ytdRevenue,
    upcomingDeadlines,
    recentActivity,
    uninvoiced,
    chartData,
    todayStr,
    in7days,
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  const summaryCards = [
    {
      label: 'Active Projects',
      value: data.activeCount,
      icon: FolderKanban2,
      colour: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Overdue Projects',
      value: data.overdueCount,
      icon: AlertTriangle,
      colour: 'text-red-600',
      bg: 'bg-red-50',
      highlight: data.overdueCount > 0,
    },
    {
      label: 'Awaiting Invoice',
      value: data.awaitingInvoiceCount,
      icon: Clock,
      colour: 'text-amber-600',
      bg: 'bg-amber-50',
      href: '/invoices/new',
    },
    {
      label: 'Outstanding (ZAR)',
      value: formatCurrency(data.outstanding),
      icon: FileText,
      colour: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: 'Month Revenue',
      value: formatCurrency(data.monthRevenue),
      icon: DollarSign,
      colour: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'YTD Revenue',
      value: formatCurrency(data.ytdRevenue),
      icon: TrendingUp,
      colour: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
  ]

  // Group uninvoiced by company
  const uninvoicedByCompany = data.uninvoiced.reduce((acc, p) => {
    const key = p.companyName ?? 'Unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {} as Record<string, typeof data.uninvoiced>)

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Dashboard" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {summaryCards.map((card, i) => {
            const Icon = card.icon
            return (
              <Card key={i} className={card.highlight ? 'ring-2 ring-red-300' : ''}>
                <CardContent className="p-4">
                  <div className={`inline-flex p-2 rounded-lg ${card.bg} mb-2`}>
                    <Icon size={18} className={card.colour} />
                  </div>
                  <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                  <p className="text-xl font-bold text-gray-900">{card.value}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Main panels grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Upcoming Deadlines */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Calendar size={18} className="text-gray-500" />
                Upcoming Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.upcomingDeadlines.length === 0 ? (
                <p className="px-6 pb-4 text-sm text-gray-400">No active projects.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {data.upcomingDeadlines.map(p => {
                    const isOverdue = p.deadline < data.todayStr
                    const isDueSoon = !isOverdue && p.deadline <= data.in7days
                    return (
                      <Link
                        key={p.id}
                        href={`/projects/${p.id}`}
                        className={`flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors ${isOverdue ? 'bg-red-50' : isDueSoon ? 'bg-amber-50' : ''}`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.clientName} · {p.companyName}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-600' : 'text-gray-500'}`}>
                            {formatDate(p.deadline)}
                          </span>
                          <Badge className={getStatusBadgeClass(p.status)}>
                            {getStatusConfig(p.status).label}
                          </Badge>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.recentActivity.length === 0 ? (
                <p className="px-6 pb-4 text-sm text-gray-400">No activity yet.</p>
              ) : (
                <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                  {data.recentActivity.map(a => (
                    <div key={a.id} className="px-6 py-3">
                      <p className="text-xs text-gray-700">{a.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{a.createdAt?.slice(0, 16).replace('T', ' ')}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Uninvoiced Projects */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Uninvoiced Projects</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {Object.keys(uninvoicedByCompany).length === 0 ? (
                <p className="px-6 pb-4 text-sm text-gray-400">All finished projects have been invoiced.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {Object.entries(uninvoicedByCompany).map(([company, projs]) => (
                    <div key={company} className="px-6 py-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{company}</p>
                      {projs.map(p => (
                        <Link key={p.id} href={`/projects/${p.id}`} className="block text-sm text-gray-700 hover:text-blue-600 py-0.5">
                          {p.name}
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Revenue Chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle>Monthly Revenue (last 12 months)</CardTitle>
            </CardHeader>
            <CardContent>
              <DashboardChart data={data.chartData} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Inline icon since we can't import from lucide with a custom name easily
function FolderKanban2({ size, className }: { size: number; className: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  )
}
