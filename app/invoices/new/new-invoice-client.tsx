'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { formatCurrency } from '@/lib/utils'
import { createInvoice } from '../actions'
import { format, addDays } from 'date-fns'

type Project = {
  id: string; name: string; productionCompanyId: string;
  clientName: string | null; companyName: string | null;
}

export function NewInvoiceClient({ finishedProjects, companies, projectCosts, settings }: {
  finishedProjects: Project[]
  companies: { id: string; name: string }[]
  projectCosts: Record<string, number>
  settings: any
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [projectPrices, setProjectPrices] = useState<Record<string, number>>({})

  const today = format(new Date(), 'yyyy-MM-dd')
  const defaultDue = format(addDays(new Date(), 30), 'yyyy-MM-dd')

  const companyProjects = finishedProjects.filter(p => p.productionCompanyId === selectedCompanyId)
  const subtotal = selectedProjectIds.reduce((sum, id) => sum + (projectPrices[id] ?? projectCosts[id] ?? 0), 0)
  const vatRate = settings?.vatRate ?? 15
  const includeVat = settings?.includeVat ?? true
  const vatAmount = includeVat ? Math.round(subtotal * vatRate / 100 * 100) / 100 : 0
  const total = subtotal + vatAmount

  function toggleProject(id: string) {
    setSelectedProjectIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id)
      } else {
        setProjectPrices(p => ({ ...p, [id]: projectCosts[id] ?? 0 }))
        return [...prev, id]
      }
    })
  }

  function handleCompanyChange(companyId: string) {
    setSelectedCompanyId(companyId)
    setSelectedProjectIds([])
    setProjectPrices({})
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (selectedProjectIds.length === 0) {
      toast('Please select at least one project', 'error')
      return
    }
    const fd = new FormData(e.currentTarget)
    selectedProjectIds.forEach(id => {
      fd.append('projectIds', id)
      fd.append(`priceOverride_${id}`, String(projectPrices[id] ?? projectCosts[id] ?? 0))
    })
    fd.set('productionCompanyId', selectedCompanyId)
    startTransition(async () => {
      const invoiceId = await createInvoice(fd)
      toast('Invoice created')
      router.push(`/invoices/${invoiceId}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Step 1: Select Company */}
      <Card>
        <CardHeader><CardTitle>1. Select Production Company</CardTitle></CardHeader>
        <CardContent>
          <Select value={selectedCompanyId} onChange={e => handleCompanyChange(e.target.value)} required>
            <option value="">Choose company...</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </CardContent>
      </Card>

      {/* Step 2: Select Projects + Set Prices */}
      {selectedCompanyId && (
        <Card>
          <CardHeader><CardTitle>2. Select Projects to Invoice</CardTitle></CardHeader>
          <CardContent>
            {companyProjects.length === 0 ? (
              <p className="text-sm text-gray-400">No finished projects for this company.</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[auto_1fr_160px] gap-x-4 px-3 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  <span />
                  <span>Project</span>
                  <span className="text-right">Amount (ZAR)</span>
                </div>
                {companyProjects.map(p => (
                  <div
                    key={p.id}
                    className={`grid grid-cols-[auto_1fr_160px] gap-x-4 items-center p-3 rounded-lg border transition-colors ${selectedProjectIds.includes(p.id) ? 'border-[#1e3a5f] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedProjectIds.includes(p.id)}
                      onChange={() => toggleProject(p.id)}
                      className="w-4 h-4 cursor-pointer"
                    />
                    <label
                      className="cursor-pointer"
                      onClick={() => toggleProject(p.id)}
                    >
                      <p className="font-medium text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.clientName}</p>
                    </label>
                    {selectedProjectIds.includes(p.id) ? (
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={projectPrices[p.id] ?? projectCosts[p.id] ?? 0}
                        onChange={e => setProjectPrices(prev => ({ ...prev, [p.id]: parseFloat(e.target.value) || 0 }))}
                        onClick={e => e.stopPropagation()}
                        className="text-right h-8"
                      />
                    ) : (
                      <span className="text-right text-sm font-medium text-gray-500">{formatCurrency(projectCosts[p.id] ?? 0)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Invoice Details */}
      {selectedProjectIds.length > 0 && (
        <Card>
          <CardHeader><CardTitle>3. Invoice Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Invoice Date *</Label>
                <Input name="invoiceDate" type="date" defaultValue={today} required />
              </div>
              <div>
                <Label>Payment Due Date *</Label>
                <Input name="dueDate" type="date" defaultValue={defaultDue} required />
              </div>
            </div>
            <div>
              <Label>PO / Reference Number (optional)</Label>
              <Input name="poReference" placeholder="Purchase order or reference number from client" />
            </div>

            {/* Summary */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              {includeVat && (
                <div className="flex justify-between">
                  <span className="text-gray-600">VAT ({vatRate}%)</span>
                  <span className="font-medium">{formatCurrency(vatAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="font-bold text-gray-900">Total Due</span>
                <span className="font-bold text-gray-900 text-lg">{formatCurrency(total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedProjectIds.length > 0 && (
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={pending} size="lg">
            {pending ? 'Creating...' : 'Create Invoice'}
          </Button>
        </div>
      )}
    </form>
  )
}
