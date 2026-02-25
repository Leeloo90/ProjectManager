'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface ChartData {
  month: string
  revenue: number
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-medium text-gray-700">{label}</p>
        <p className="text-green-600 font-semibold">
          R {payload[0].value.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
        </p>
      </div>
    )
  }
  return null
}

export function DashboardChart({ data }: { data: ChartData[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="revenue" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
