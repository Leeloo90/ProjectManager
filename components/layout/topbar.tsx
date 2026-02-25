interface TopbarProps {
  title: string
  actions?: React.ReactNode
}

export function Topbar({ title, actions }: TopbarProps) {
  return (
    <div className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}
