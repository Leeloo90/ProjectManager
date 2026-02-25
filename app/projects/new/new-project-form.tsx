'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { createProject } from '../actions'
import { createClient } from '@/app/contacts/actions'
import { useToast } from '@/components/ui/toast'
import { format } from 'date-fns'
import { UserPlus } from 'lucide-react'

type Company = { id: string; name: string; isActive: boolean | null }
type Client = { id: string; name: string; productionCompanyId: string }

export function NewProjectForm({ companies, clients: initialClients }: { companies: Company[]; clients: Client[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [newClientPending, startNewClientTransition] = useTransition()
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [localClients, setLocalClients] = useState<Client[]>(initialClients)
  const [newClientOpen, setNewClientOpen] = useState(false)

  const today = format(new Date(), 'yyyy-MM-dd')
  const activeCompanies = companies.filter(c => c.isActive)
  const filteredClients = localClients.filter(c => c.productionCompanyId === selectedCompanyId)

  function handleCompanyChange(companyId: string) {
    setSelectedCompanyId(companyId)
    setSelectedClientId('')
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const id = await createProject(fd)
      toast('Project created')
      router.push(`/projects/${id}`)
    })
  }

  function handleCreateClient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('productionCompanyId', selectedCompanyId)
    startNewClientTransition(async () => {
      const newClient = await createClient(fd)
      setLocalClients(prev => [...prev, newClient])
      setSelectedClientId(newClient.id)
      setNewClientOpen(false)
      toast(`Client "${newClient.name}" created`)
    })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="name">Project Name *</Label>
              <Input id="name" name="name" placeholder='e.g. "Discovery Summer Campaign 2026"' required />
            </div>

            <div>
              <Label htmlFor="productionCompanyId">Production Company *</Label>
              <Select
                id="productionCompanyId"
                name="productionCompanyId"
                required
                value={selectedCompanyId}
                onChange={e => handleCompanyChange(e.target.value)}
              >
                <option value="">Select company...</option>
                {activeCompanies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="clientId">Client *</Label>
                {selectedCompanyId && (
                  <button
                    type="button"
                    onClick={() => setNewClientOpen(true)}
                    className="flex items-center gap-1 text-xs text-[#1e3a5f] hover:underline font-medium"
                  >
                    <UserPlus size={12} /> New Client
                  </button>
                )}
              </div>
              <Select
                id="clientId"
                name="clientId"
                required
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                disabled={!selectedCompanyId}
              >
                <option value="">
                  {selectedCompanyId
                    ? (filteredClients.length === 0 ? 'No clients — add one above' : 'Select client...')
                    : 'Select company first'}
                </option>
                {filteredClients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date *</Label>
                <Input id="startDate" name="startDate" type="date" defaultValue={today} required />
              </div>
              <div>
                <Label htmlFor="deadline">Deadline *</Label>
                <Input id="deadline" name="deadline" type="date" required />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} placeholder="Any initial notes about this project..." />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Creating...' : 'Create Project'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* New Client modal */}
      <Dialog open={newClientOpen} onClose={() => setNewClientOpen(false)} title="Add New Client">
        <form onSubmit={handleCreateClient} className="p-6 space-y-4">
          <p className="text-sm text-gray-500">
            Adding client for <span className="font-medium text-gray-700">{activeCompanies.find(c => c.id === selectedCompanyId)?.name}</span>
          </p>
          <div>
            <Label>Client Name *</Label>
            <Input name="name" required placeholder='e.g. "Sarah Johnson"' />
          </div>
          <div>
            <Label>Contact Person</Label>
            <Input name="contactPerson" placeholder="Name of contact at client" />
          </div>
          <div>
            <Label>Email</Label>
            <Input name="contactEmail" type="email" placeholder="email@example.com" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input name="contactPhone" placeholder="+27 ..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setNewClientOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={newClientPending}>
              {newClientPending ? 'Creating...' : 'Create Client'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
