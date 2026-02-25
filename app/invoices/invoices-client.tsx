'use client'
import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, formatDate, getStatusBadgeClass } from '@/lib/utils'
import { markInvoicePaid, voidInvoice, markInvoiceSent, deleteInvoice } from './actions'
import { useRouter } from 'next/navigation'
import { Eye, DollarSign, XCircle, Send, Trash2 } from 'lucide-react'
import Link from 'next/link'

type Invoice = {
  id: string; invoiceNumber: string; status: string | null; invoiceDate: string;
  dueDate: string; total: number; subtotal: number; vatAmount: number;
  paymentDate: string | null; paymentMethod: string | null; poReference: string | null;
  productionCompanyId: string; companyName: string | null;
}

function PaymentDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const [pending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await markInvoicePaid(invoice.id, fd)
      toast('Invoice marked as paid')
      onClose()
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <p className="text-sm text-gray-600">Record payment for invoice <strong>{invoice.invoiceNumber}</strong> ({formatCurrency(invoice.total)})</p>
      <div>
        <Label>Payment Date *</Label>
        <Input name="paymentDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
      </div>
      <div>
        <Label>Payment Method *</Label>
        <Select name="paymentMethod" required>
          <option value="EFT">EFT</option>
          <option value="Cash">Cash</option>
          <option value="Other">Other</option>
        </Select>
      </div>
      <div>
        <Label>Reference (optional)</Label>
        <Input name="paymentReference" placeholder="Bank reference, etc." />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Mark as Paid'}</Button>
      </div>
    </form>
  )
}

export function InvoicesClient({ invoices: allInvoices, finishedProjects, companies }: {
  invoices: Invoice[]
  finishedProjects: { id: string; name: string; productionCompanyId: string; companyName: string | null }[]
  companies: { id: string; name: string }[]
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentDialog, setPaymentDialog] = useState<Invoice | null>(null)
  const [voidConfirm, setVoidConfirm] = useState<Invoice | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Invoice | null>(null)

  const filtered = allInvoices.filter(inv => {
    const matchSearch = !search ||
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      (inv.companyName ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter
    return matchSearch && matchStatus
  })

  function handleVoid() {
    if (!voidConfirm) return
    startTransition(async () => {
      await voidInvoice(voidConfirm.id)
      toast('Invoice voided — projects returned to Finished status')
      setVoidConfirm(null)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!deleteConfirm) return
    startTransition(async () => {
      await deleteInvoice(deleteConfirm.id)
      toast('Invoice deleted')
      setDeleteConfirm(null)
      router.refresh()
    })
  }

  const statusLabels: Record<string, string> = { sent: 'Sent', paid: 'Paid', voided: 'Voided', draft: 'Draft' }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Filters */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <Input
          placeholder="Search invoices, companies..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-1.5">
          {['all', 'draft', 'sent', 'paid', 'voided'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? 'bg-[#1e3a5f] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {s === 'all' ? `All (${allInvoices.length})` : statusLabels[s]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-gray-400 text-sm">
          {allInvoices.length === 0 ? 'No invoices yet. Finish some projects and create an invoice.' : 'No invoices match your filters.'}
        </Card>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Invoice #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Production Company</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Due</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3 text-gray-600">{inv.companyName}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(inv.invoiceDate)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(inv.total)}</td>
                  <td className="px-4 py-3">
                    <Badge className={getStatusBadgeClass(inv.status ?? 'sent')}>
                      {statusLabels[inv.status ?? 'sent']}
                    </Badge>
                    {inv.paymentDate && <p className="text-xs text-gray-400 mt-0.5">{formatDate(inv.paymentDate)}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link href={`/invoices/${inv.id}`}>
                        <Button size="icon" variant="ghost" title="View"><Eye size={15} /></Button>
                      </Link>
                      {inv.status === 'draft' && (
                        <Button size="icon" variant="ghost" title="Mark as Sent" onClick={() => {
                          startTransition(async () => {
                            await markInvoiceSent(inv.id)
                            toast('Invoice marked as sent')
                            router.refresh()
                          })
                        }}>
                          <Send size={15} className="text-blue-600" />
                        </Button>
                      )}
                      {inv.status === 'sent' && (
                        <Button size="icon" variant="ghost" title="Mark Paid" onClick={() => setPaymentDialog(inv)}>
                          <DollarSign size={15} className="text-green-600" />
                        </Button>
                      )}
                      {(inv.status === 'draft' || inv.status === 'sent') && (
                        <Button size="icon" variant="ghost" title="Void" onClick={() => setVoidConfirm(inv)}>
                          <XCircle size={15} className="text-red-500" />
                        </Button>
                      )}
                      {inv.status === 'voided' && (
                        <Button size="icon" variant="ghost" title="Delete" onClick={() => setDeleteConfirm(inv)}>
                          <Trash2 size={15} className="text-red-500" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment dialog */}
      <Dialog open={!!paymentDialog} onClose={() => setPaymentDialog(null)} title="Log Payment">
        {paymentDialog && <PaymentDialog invoice={paymentDialog} onClose={() => setPaymentDialog(null)} />}
      </Dialog>

      <ConfirmDialog
        open={!!voidConfirm}
        onClose={() => setVoidConfirm(null)}
        onConfirm={handleVoid}
        title="Void Invoice"
        message={`Voiding invoice ${voidConfirm?.invoiceNumber} will return all linked projects to Finished status. The invoice record is preserved.`}
        confirmLabel="Void Invoice"
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Invoice"
        message={`This will permanently delete invoice ${deleteConfirm?.invoiceNumber}. This cannot be undone.`}
        confirmLabel="Delete Invoice"
      />
    </div>
  )
}
