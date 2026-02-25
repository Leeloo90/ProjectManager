'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Dialog } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { Plus, Building2, User, Phone, Mail, Edit, Power, ChevronDown, ChevronUp } from 'lucide-react'
import {
  createProductionCompany, updateProductionCompany, toggleCompanyActive,
  createClient, updateClient, deleteClient
} from './actions'

type Company = {
  id: string; name: string; billingAddress: string | null; vatNumber: string | null;
  primaryContactName: string; primaryContactEmail: string; primaryContactPhone: string | null;
  secondaryContactName: string | null; secondaryContactEmail: string | null;
  notes: string | null; isActive: boolean | null;
}
type Client = {
  id: string; name: string; productionCompanyId: string;
  contactPerson: string | null; contactEmail: string | null; contactPhone: string | null; notes: string | null;
}

function CompanyForm({ company, onSave, onClose }: { company?: Company; onSave: (fd: FormData) => void; onClose: () => void }) {
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(() => { onSave(fd) })
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="name">Company Name *</Label>
          <Input id="name" name="name" defaultValue={company?.name} required />
        </div>
        <div className="col-span-2">
          <Label htmlFor="billingAddress">Billing Address *</Label>
          <Textarea id="billingAddress" name="billingAddress" defaultValue={company?.billingAddress ?? ''} rows={3} />
        </div>
        <div>
          <Label htmlFor="vatNumber">VAT Number</Label>
          <Input id="vatNumber" name="vatNumber" defaultValue={company?.vatNumber ?? ''} />
        </div>
        <div>
          <Label htmlFor="primaryContactName">Primary Contact Name *</Label>
          <Input id="primaryContactName" name="primaryContactName" defaultValue={company?.primaryContactName} required />
        </div>
        <div>
          <Label htmlFor="primaryContactEmail">Primary Contact Email *</Label>
          <Input id="primaryContactEmail" name="primaryContactEmail" type="email" defaultValue={company?.primaryContactEmail} required />
        </div>
        <div>
          <Label htmlFor="primaryContactPhone">Primary Contact Phone</Label>
          <Input id="primaryContactPhone" name="primaryContactPhone" defaultValue={company?.primaryContactPhone ?? ''} />
        </div>
        <div>
          <Label htmlFor="secondaryContactName">Secondary Contact Name</Label>
          <Input id="secondaryContactName" name="secondaryContactName" defaultValue={company?.secondaryContactName ?? ''} />
        </div>
        <div>
          <Label htmlFor="secondaryContactEmail">Secondary Contact Email</Label>
          <Input id="secondaryContactEmail" name="secondaryContactEmail" type="email" defaultValue={company?.secondaryContactEmail ?? ''} />
        </div>
        <div className="col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" defaultValue={company?.notes ?? ''} rows={2} placeholder="Payment terms, preferences, etc." />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Save Company'}</Button>
      </div>
    </form>
  )
}

function ClientForm({ client, companies, onSave, onClose }: { client?: Client; companies: Company[]; onSave: (fd: FormData) => void; onClose: () => void }) {
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(() => { onSave(fd) })
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div>
        <Label htmlFor="name">Client / Brand Name *</Label>
        <Input id="name" name="name" defaultValue={client?.name} required />
      </div>
      <div>
        <Label htmlFor="productionCompanyId">Production Company *</Label>
        <Select id="productionCompanyId" name="productionCompanyId" defaultValue={client?.productionCompanyId} required>
          <option value="">Select company...</option>
          {companies.filter(c => c.isActive).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="contactPerson">Contact Person</Label>
          <Input id="contactPerson" name="contactPerson" defaultValue={client?.contactPerson ?? ''} />
        </div>
        <div>
          <Label htmlFor="contactEmail">Contact Email</Label>
          <Input id="contactEmail" name="contactEmail" type="email" defaultValue={client?.contactEmail ?? ''} />
        </div>
        <div>
          <Label htmlFor="contactPhone">Contact Phone</Label>
          <Input id="contactPhone" name="contactPhone" defaultValue={client?.contactPhone ?? ''} />
        </div>
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={client?.notes ?? ''} rows={2} />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Save Client'}</Button>
      </div>
    </form>
  )
}

export function ContactsClient({ companies, clients }: { companies: Company[]; clients: Client[] }) {
  const { toast } = useToast()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'companies' | 'clients'>('companies')
  const [companyDialog, setCompanyDialog] = useState<{ open: boolean; company?: Company }>({ open: false })
  const [clientDialog, setClientDialog] = useState<{ open: boolean; client?: Client }>({ open: false })
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Filter directly from props — no stale local state copies
  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.primaryContactEmail.toLowerCase().includes(search.toLowerCase())
  )
  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  function handleSaveCompany(fd: FormData) {
    startTransition(async () => {
      if (companyDialog.company) {
        await updateProductionCompany(companyDialog.company.id, fd)
        toast('Company updated')
      } else {
        await createProductionCompany(fd)
        toast('Company created')
      }
      setCompanyDialog({ open: false })
      router.refresh()
    })
  }

  function handleSaveClient(fd: FormData) {
    startTransition(async () => {
      if (clientDialog.client) {
        await updateClient(clientDialog.client.id, fd)
        toast('Client updated')
      } else {
        await createClient(fd)
        toast('Client created')
      }
      setClientDialog({ open: false })
      router.refresh()
    })
  }

  function handleToggleActive(id: string, current: boolean) {
    startTransition(async () => {
      await toggleCompanyActive(id, !current)
      toast(current ? 'Company deactivated' : 'Company activated')
      router.refresh()
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Tabs + search + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden">
          <button
            onClick={() => setTab('companies')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'companies' ? 'bg-[#1e3a5f] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Production Companies ({companies.length})
          </button>
          <button
            onClick={() => setTab('clients')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'clients' ? 'bg-[#1e3a5f] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Clients ({clients.length})
          </button>
        </div>
        <Input
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex-1" />
        {tab === 'companies' ? (
          <Button onClick={() => setCompanyDialog({ open: true })}>
            <Plus size={16} /> New Company
          </Button>
        ) : (
          <Button onClick={() => setClientDialog({ open: true })}>
            <Plus size={16} /> New Client
          </Button>
        )}
      </div>

      {/* Companies tab */}
      {tab === 'companies' && (
        <div className="space-y-3">
          {filteredCompanies.length === 0 && (
            <Card><CardContent className="py-10 text-center text-gray-400 text-sm">No companies yet.</CardContent></Card>
          )}
          {filteredCompanies.map(company => {
            const companyClients = clients.filter(c => c.productionCompanyId === company.id)
            const expanded = expandedCompany === company.id
            return (
              <Card key={company.id} className={!company.isActive ? 'opacity-60' : ''}>
                <div
                  className="flex items-center gap-4 px-6 py-4 cursor-pointer"
                  onClick={() => setExpandedCompany(expanded ? null : company.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 size={16} className="text-gray-400 shrink-0" />
                      <h3 className="font-semibold text-gray-900">{company.name}</h3>
                      {!company.isActive && <Badge className="bg-gray-100 text-gray-500">Inactive</Badge>}
                      <Badge className="bg-blue-50 text-blue-700">{companyClients.length} client{companyClients.length !== 1 ? 's' : ''}</Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><User size={12} />{company.primaryContactName}</span>
                      <span className="flex items-center gap-1"><Mail size={12} />{company.primaryContactEmail}</span>
                      {company.primaryContactPhone && <span className="flex items-center gap-1"><Phone size={12} />{company.primaryContactPhone}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="icon" variant="ghost" onClick={e => { e.stopPropagation(); setCompanyDialog({ open: true, company }) }}>
                      <Edit size={15} />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={e => { e.stopPropagation(); handleToggleActive(company.id, !!company.isActive) }}
                      title={company.isActive ? 'Deactivate' : 'Activate'}>
                      <Power size={15} className={company.isActive ? 'text-green-600' : 'text-gray-400'} />
                    </Button>
                    {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </div>
                {expanded && (
                  <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 space-y-3">
                    {company.billingAddress && (
                      <div><span className="text-xs font-medium text-gray-500">Billing Address:</span><p className="text-sm text-gray-700 mt-0.5 whitespace-pre-line">{company.billingAddress}</p></div>
                    )}
                    {company.vatNumber && (
                      <div><span className="text-xs font-medium text-gray-500">VAT Number:</span><p className="text-sm text-gray-700">{company.vatNumber}</p></div>
                    )}
                    {company.notes && (
                      <div><span className="text-xs font-medium text-gray-500">Notes:</span><p className="text-sm text-gray-700">{company.notes}</p></div>
                    )}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500">Clients</span>
                        <Button size="sm" variant="outline" onClick={() => setClientDialog({ open: true })}>
                          <Plus size={13} /> Add Client
                        </Button>
                      </div>
                      {companyClients.length === 0
                        ? <p className="text-xs text-gray-400">No clients yet.</p>
                        : companyClients.map(c => (
                          <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-gray-200 last:border-0">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{c.name}</p>
                              {c.contactEmail && <p className="text-xs text-gray-500">{c.contactEmail}</p>}
                            </div>
                            <Button size="icon" variant="ghost" onClick={() => setClientDialog({ open: true, client: c })}>
                              <Edit size={14} />
                            </Button>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Clients tab */}
      {tab === 'clients' && (
        <div className="space-y-2">
          {filteredClients.length === 0 && (
            <Card><CardContent className="py-10 text-center text-gray-400 text-sm">No clients yet.</CardContent></Card>
          )}
          {filteredClients.map(client => {
            const company = companies.find(c => c.id === client.productionCompanyId)
            return (
              <Card key={client.id}>
                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{client.name}</p>
                    <p className="text-xs text-gray-500">{company?.name}</p>
                    {client.contactEmail && <p className="text-xs text-gray-500">{client.contactEmail}</p>}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setClientDialog({ open: true, client })}>
                    <Edit size={15} />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialogs */}
      <Dialog
        open={companyDialog.open}
        onClose={() => setCompanyDialog({ open: false })}
        title={companyDialog.company ? 'Edit Production Company' : 'New Production Company'}
        className="max-w-2xl"
      >
        <CompanyForm
          company={companyDialog.company}
          onSave={handleSaveCompany}
          onClose={() => setCompanyDialog({ open: false })}
        />
      </Dialog>

      <Dialog
        open={clientDialog.open}
        onClose={() => setClientDialog({ open: false })}
        title={clientDialog.client ? 'Edit Client' : 'New Client'}
      >
        <ClientForm
          client={clientDialog.client}
          companies={companies}
          onSave={handleSaveClient}
          onClose={() => setClientDialog({ open: false })}
        />
      </Dialog>
    </div>
  )
}
