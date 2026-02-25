'use client'
import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, formatDate, getStatusBadgeClass, getBracketLabel } from '@/lib/utils'
import { markInvoicePaid, voidInvoice, updateInvoice, markInvoiceSent, deleteInvoice } from '../actions'
import { useRouter } from 'next/navigation'
import { DollarSign, XCircle, Printer, Edit, Send, Trash2, Plus } from 'lucide-react'
import { InvoicePDFButton } from './invoice-pdf-button'

type DialogProject = { id: string; name: string; clientName: string | null; price: number }

export function InvoiceDetailClient({ invoice, linkedProjects, projectDetails, settings, availableProjects, availableProjectCosts }: {
  invoice: any
  linkedProjects: any[]
  projectDetails: Record<string, { deliverables: any[]; shoot: any | null }>
  settings: any
  availableProjects: any[]
  availableProjectCosts: Record<string, number>
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [paymentDialog, setPaymentDialog] = useState(false)
  const [voidConfirm, setVoidConfirm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [editDialog, setEditDialog] = useState(false)
  const [sendConfirm, setSendConfirm] = useState(false)

  // Edit dialog state
  const [dialogProjects, setDialogProjects] = useState<DialogProject[]>([])
  const [addProjectId, setAddProjectId] = useState('')

  const statusLabels: Record<string, string> = { sent: 'Sent', paid: 'Paid', voided: 'Voided', draft: 'Draft' }

  // Parse stored line item overrides
  const lineItemOverrides: Record<string, number> = invoice.lineItemOverrides
    ? JSON.parse(invoice.lineItemOverrides)
    : {}

  function getProjectTotal(projectId: string, details: { deliverables: any[]; shoot: any | null }): number {
    if (lineItemOverrides[projectId] !== undefined) return lineItemOverrides[projectId]
    const delivTotal = details.deliverables.reduce((s: number, d: any) => s + d.calculatedCost, 0)
    const shootCost = details.shoot?.calculatedShootCost ?? 0
    return delivTotal + shootCost
  }

  function openEditDialog() {
    const initialProjects: DialogProject[] = linkedProjects.map(p => {
      const details = projectDetails[p.id]
      const defaultCost = details
        ? details.deliverables.reduce((s: number, d: any) => s + d.calculatedCost, 0) + (details.shoot?.calculatedShootCost ?? 0)
        : 0
      return {
        id: p.id,
        name: p.name,
        clientName: p.clientName,
        price: lineItemOverrides[p.id] !== undefined ? lineItemOverrides[p.id] : defaultCost,
      }
    })
    setDialogProjects(initialProjects)
    setAddProjectId('')
    setEditDialog(true)
  }

  function removeDialogProject(id: string) {
    setDialogProjects(prev => prev.filter(p => p.id !== id))
  }

  function updateDialogProjectPrice(id: string, price: number) {
    setDialogProjects(prev => prev.map(p => p.id === id ? { ...p, price } : p))
  }

  function addDialogProject() {
    if (!addProjectId) return
    const project = availableProjects.find((p: any) => p.id === addProjectId)
    if (!project) return
    setDialogProjects(prev => [...prev, {
      id: project.id,
      name: project.name,
      clientName: project.clientName,
      price: availableProjectCosts[project.id] ?? 0,
    }])
    setAddProjectId('')
  }

  const dialogSubtotal = dialogProjects.reduce((s, p) => s + p.price, 0)
  const dialogVatRate = settings?.vatRate ?? 15
  const dialogIncludeVat = settings?.includeVat ?? true
  const dialogVatAmount = dialogIncludeVat ? Math.round(dialogSubtotal * dialogVatRate / 100 * 100) / 100 : 0
  const dialogTotal = dialogSubtotal + dialogVatAmount

  const projectsToAdd = availableProjects.filter((p: any) => !dialogProjects.find(dp => dp.id === p.id))

  function handleMarkPaid(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await markInvoicePaid(invoice.id, fd)
      toast('Invoice marked as paid')
      setPaymentDialog(false)
      router.refresh()
    })
  }

  function handleVoid() {
    startTransition(async () => {
      await voidInvoice(invoice.id)
      toast('Invoice voided')
      setVoidConfirm(false)
      router.refresh()
    })
  }

  function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    // Ensure all dialog project IDs and prices are in the FormData
    dialogProjects.forEach(p => {
      if (!fd.getAll('projectIds').includes(p.id)) fd.append('projectIds', p.id)
      fd.set(`priceOverride_${p.id}`, String(p.price))
    })
    startTransition(async () => {
      await updateInvoice(invoice.id, fd)
      toast('Invoice updated')
      setEditDialog(false)
      router.refresh()
    })
  }

  function handleMarkSent() {
    startTransition(async () => {
      await markInvoiceSent(invoice.id)
      toast('Invoice marked as sent')
      setSendConfirm(false)
      router.refresh()
    })
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteInvoice(invoice.id)
      toast('Invoice deleted')
      setDeleteConfirm(false)
      router.push('/invoices')
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge className={getStatusBadgeClass(invoice.status)}>{statusLabels[invoice.status ?? 'sent']}</Badge>
            {invoice.paymentDate && <span className="text-sm text-gray-500">Paid on {formatDate(invoice.paymentDate)} via {invoice.paymentMethod}</span>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()}><Printer size={15} /> Print</Button>
            <InvoicePDFButton invoice={invoice} linkedProjects={linkedProjects} projectDetails={projectDetails} settings={settings} />
            {invoice.status === 'draft' && (
              <>
                <Button variant="outline" onClick={openEditDialog}><Edit size={15} /> Edit</Button>
                <Button onClick={() => setSendConfirm(true)}><Send size={15} /> Mark as Sent</Button>
              </>
            )}
            {invoice.status === 'sent' && (
              <Button onClick={() => setPaymentDialog(true)}><DollarSign size={15} /> Mark Paid</Button>
            )}
            {(invoice.status === 'draft' || invoice.status === 'sent') && (
              <Button variant="ghost" onClick={() => setVoidConfirm(true)}>
                <XCircle size={15} className="text-red-500" /> Void
              </Button>
            )}
            {invoice.status === 'voided' && (
              <Button variant="ghost" onClick={() => setDeleteConfirm(true)}>
                <Trash2 size={15} className="text-red-500" /> Delete
              </Button>
            )}
          </div>
        </div>

        {/* Invoice document */}
        <Card className="print:shadow-none print:border-0">
          <CardContent className="p-8 space-y-8">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <img src="/logo.png" alt={settings?.businessName ?? 'Ambient Arts'} className="h-16 object-contain" />
                {settings?.businessAddress && <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{settings.businessAddress}</p>}
                {settings?.vatNumber && <p className="text-xs text-gray-500">VAT: {settings.vatNumber}</p>}
                {settings?.businessRegistrationNumber && <p className="text-xs text-gray-400 italic">Reg: {settings.businessRegistrationNumber}</p>}
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-bold text-gray-800">INVOICE</h2>
                <p className="text-lg font-semibold text-gray-700">{invoice.invoiceNumber}</p>
                <p className="text-sm text-gray-500 mt-1">Date: {formatDate(invoice.invoiceDate)}</p>
                <p className="text-sm text-gray-500">Due: {formatDate(invoice.dueDate)}</p>
                {invoice.poReference && <p className="text-xs text-gray-500">PO: {invoice.poReference}</p>}
              </div>
            </div>

            {/* Bill to */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bill To</p>
              <p className="font-semibold text-gray-900">{invoice.companyName}</p>
              {invoice.billingAddress && <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.billingAddress}</p>}
              {invoice.vatNumber && <p className="text-xs text-gray-500">VAT: {invoice.vatNumber}</p>}
              <p className="text-sm text-gray-600 mt-1">Attn: {invoice.primaryContactName} · {invoice.primaryContactEmail}</p>
            </div>

            {/* Line items */}
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-2 text-gray-700 font-semibold">Description</th>
                    <th className="text-right py-2 text-gray-700 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {linkedProjects.map(p => {
                    const details = projectDetails[p.id]
                    const projectTotal = getProjectTotal(p.id, details)
                    const isOverridden = lineItemOverrides[p.id] !== undefined
                    return (
                      <>
                        <tr key={`${p.id}-header`} className="border-t border-gray-100">
                          <td colSpan={2} className="py-3 font-semibold text-gray-900">{p.name} <span className="text-gray-400 font-normal text-xs">— {p.clientName}</span></td>
                        </tr>
                        {!isOverridden && details.deliverables.map((d: any) => (
                          <tr key={d.id}>
                            <td className="py-1.5 pl-4 text-gray-600">
                              {d.name}
                              <span className="block text-xs text-gray-400">
                                {getBracketLabel(d.durationBracket)} · {d.primaryFormat} · {d.editType === 'colour_only' ? 'Colour Only' : d.editType === 'basic' ? 'Basic Edit' : 'Advanced Edit'}
                                {d.additionalFormats ? ` · ${d.additionalFormats} extra format(s)` : ''}
                              </span>
                            </td>
                            <td className="py-1.5 text-right text-gray-700">{formatCurrency(d.calculatedCost)}</td>
                          </tr>
                        ))}
                        {!isOverridden && details.shoot && (
                          <tr key={`${p.id}-shoot`}>
                            <td className="py-1.5 pl-4 text-gray-600">
                              Shoot ({details.shoot.shootType === 'half_day' ? 'Half Day' : 'Full Day'} · {details.shoot.cameraBody === 'a7siii' ? 'Sony a7SIII' : 'Sony a7III'})
                            </td>
                            <td className="py-1.5 text-right text-gray-700">{formatCurrency(details.shoot.calculatedShootCost)}</td>
                          </tr>
                        )}
                        <tr key={`${p.id}-subtotal`} className="border-t border-gray-100">
                          <td className="py-2 pl-4 text-gray-500 text-xs">{isOverridden ? 'Custom Rate' : 'Project Subtotal'}</td>
                          <td className="py-2 text-right font-medium text-gray-800">{formatCurrency(projectTotal)}</td>
                        </tr>
                      </>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300">
                    <td className="py-3 font-semibold text-gray-900">Subtotal</td>
                    <td className="py-3 text-right font-semibold text-gray-900">{formatCurrency(invoice.subtotal)}</td>
                  </tr>
                  {invoice.vatAmount > 0 && (
                    <tr>
                      <td className="py-2 text-gray-600">VAT ({settings?.vatRate ?? 15}%)</td>
                      <td className="py-2 text-right text-gray-600">{formatCurrency(invoice.vatAmount)}</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-[#1e3a5f]">
                    <td className="py-3 text-xl font-bold text-[#1e3a5f]">TOTAL DUE</td>
                    <td className="py-3 text-right text-xl font-bold text-[#1e3a5f]">{formatCurrency(invoice.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Banking details */}
            {settings?.bankingDetails && (
              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Banking Details</p>
                <p className="text-sm text-gray-700 whitespace-pre-line">{settings.bankingDetails}</p>
              </div>
            )}

            {/* Payment terms */}
            {settings?.paymentTermsText && (
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs text-gray-500">{settings.paymentTermsText}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit dialog — full invoice editor */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} title="Edit Invoice" className="max-w-2xl">
        <form onSubmit={handleEdit} className="p-6 space-y-6">

          {/* Dates + PO ref */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Invoice Date *</Label>
              <Input name="invoiceDate" type="date" defaultValue={invoice.invoiceDate} required />
            </div>
            <div>
              <Label>Due Date *</Label>
              <Input name="dueDate" type="date" defaultValue={invoice.dueDate} required />
            </div>
          </div>
          <div>
            <Label>PO / Reference Number (optional)</Label>
            <Input name="poReference" defaultValue={invoice.poReference ?? ''} placeholder="Purchase order or reference number" />
          </div>

          {/* Projects */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Projects & Amounts</p>
            <div className="space-y-2">
              {dialogProjects.length === 0 && (
                <p className="text-sm text-gray-400 italic">No projects — add one below.</p>
              )}
              {dialogProjects.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
                  <input type="hidden" name="projectIds" value={p.id} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    {p.clientName && <p className="text-xs text-gray-500">{p.clientName}</p>}
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    name={`priceOverride_${p.id}`}
                    value={p.price}
                    onChange={e => updateDialogProjectPrice(p.id, parseFloat(e.target.value) || 0)}
                    className="w-36 h-8 text-right"
                  />
                  <button
                    type="button"
                    onClick={() => removeDialogProject(p.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    title="Remove project"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add project dropdown */}
            {projectsToAdd.length > 0 && (
              <div className="flex gap-2 mt-3">
                <Select
                  value={addProjectId}
                  onChange={e => setAddProjectId(e.target.value)}
                  className="flex-1"
                >
                  <option value="">Add a project...</option>
                  {projectsToAdd.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.clientName ? ` — ${p.clientName}` : ''} ({formatCurrency(availableProjectCosts[p.id] ?? 0)})
                    </option>
                  ))}
                </Select>
                <Button type="button" variant="outline" onClick={addDialogProject} disabled={!addProjectId}>
                  <Plus size={15} /> Add
                </Button>
              </div>
            )}
          </div>

          {/* Running total preview */}
          <div className="p-3 bg-gray-50 rounded-lg space-y-1 text-sm border border-gray-200">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(dialogSubtotal)}</span>
            </div>
            {dialogIncludeVat && (
              <div className="flex justify-between text-gray-600">
                <span>VAT ({dialogVatRate}%)</span>
                <span>{formatCurrency(dialogVatAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1">
              <span>Total</span>
              <span>{formatCurrency(dialogTotal)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} title="Record Payment">
        <form onSubmit={handleMarkPaid} className="p-6 space-y-4">
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
            <Button type="button" variant="outline" onClick={() => setPaymentDialog(false)}>Cancel</Button>
            <Button type="submit">Mark as Paid</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={sendConfirm}
        onClose={() => setSendConfirm(false)}
        onConfirm={handleMarkSent}
        title="Mark Invoice as Sent"
        message="Once marked as sent, the invoice can no longer be edited. Continue?"
        confirmLabel="Mark as Sent"
      />

      <ConfirmDialog
        open={voidConfirm}
        onClose={() => setVoidConfirm(false)}
        onConfirm={handleVoid}
        title="Void Invoice"
        message="Voiding this invoice will return all linked projects to Finished status. The invoice record will be preserved."
        confirmLabel="Void Invoice"
      />

      <ConfirmDialog
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Invoice"
        message="This will permanently delete the invoice record. This cannot be undone."
        confirmLabel="Delete Invoice"
      />
    </div>
  )
}
