'use client'
import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import {
  formatCurrency, formatDate, getStatusBadgeClass, getStatusConfig, PROJECT_STATUSES,
} from '@/lib/utils'
import {
  updateProject, updateProjectStatus, deleteProject, unlinkFrameioProject
} from '../actions'
import {
  Edit, Trash2, AlertTriangle, ExternalLink, Camera, Package,
  RotateCcw, Film, ChevronRight, Loader2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { FrameioLinkDialog } from './frameio-link-dialog'
import Link from 'next/link'

type Project = {
  id: string; name: string; status: string; startDate: string; deadline: string;
  includedRevisionRounds: number | null; drivefinalsLink: string | null;
  driveArchiveLink: string | null; notes: string | null; invoiceId: string | null;
  frameioProjectId: string | null; frameioRootFolderId: string | null;
  productionCompanyId: string; clientId: string; clientName: string | null; companyName: string | null;
}

// ─── Edit Project Form ─────────────────────────────────────────────────────────
function EditProjectForm({ project, companies, clients, onSave, onClose }: {
  project: Project; companies: any[]; clients: any[]; onSave: (fd: FormData) => void; onClose: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [selectedCompanyId, setSelectedCompanyId] = useState(project.productionCompanyId)
  const filteredClients = clients.filter((c: any) => c.productionCompanyId === selectedCompanyId)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(() => onSave(fd))
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div>
        <Label>Project Name *</Label>
        <Input name="name" defaultValue={project.name} required />
      </div>
      <div>
        <Label>Production Company *</Label>
        <Select name="productionCompanyId" defaultValue={selectedCompanyId} onChange={e => setSelectedCompanyId(e.target.value)} required>
          {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
      <div>
        <Label>Client *</Label>
        <Select name="clientId" defaultValue={project.clientId} required>
          {filteredClients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Start Date *</Label>
          <Input name="startDate" type="date" defaultValue={project.startDate} required />
        </div>
        <div>
          <Label>Deadline *</Label>
          <Input name="deadline" type="date" defaultValue={project.deadline} required />
        </div>
      </div>
      <div>
        <Label>Included Revision Rounds</Label>
        <Input name="includedRevisionRounds" type="number" min="0" defaultValue={project.includedRevisionRounds ?? 2} />
      </div>
      <div>
        <Label>Google Drive — Finals Link</Label>
        <Input name="drivefinalsLink" type="url" defaultValue={project.drivefinalsLink ?? ''} />
      </div>
      <div>
        <Label>Google Drive — Archive Link</Label>
        <Input name="driveArchiveLink" type="url" defaultValue={project.driveArchiveLink ?? ''} />
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea name="notes" defaultValue={project.notes ?? ''} rows={4} />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Update Project'}</Button>
      </div>
    </form>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ProjectDetailClient({
  project,
  deliverableCount,
  deliverableTotal,
  shootCount,
  shootTotal,
  revisionCount,
  pricingMap,
  settings,
  companies,
  clients,
}: {
  project: Project
  deliverableCount: number
  deliverableTotal: number
  shootCount: number
  shootTotal: number
  revisionCount: number
  pricingMap: Record<string, number>
  settings: any
  companies: any[]
  clients: any[]
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editProjectOpen, setEditProjectOpen] = useState(false)
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState(false)
  const [frameioLinkOpen, setFrameioLinkOpen] = useState(false)
  const [frameioLinked, setFrameioLinked] = useState(!!project.frameioProjectId)
  const [unlinkingFrameio, setUnlinkingFrameio] = useState(false)

  const today = format(new Date(), 'yyyy-MM-dd')
  const isLocked = ['invoiced', 'paid'].includes(project.status)
  const projectTotal = deliverableTotal + shootTotal
  const includedRounds = project.includedRevisionRounds ?? 2
  const revisionWarning = revisionCount > includedRounds

  function handleStatusChange(newStatus: string) {
    startTransition(async () => {
      try {
        await updateProjectStatus(project.id, newStatus)
        toast(`Status updated to ${getStatusConfig(newStatus).label}`)
        router.refresh()
      } catch (e: any) {
        toast(e.message, 'error')
      }
    })
  }

  function handleDeleteProject() {
    startTransition(async () => {
      try {
        await deleteProject(project.id)
        toast('Project deleted')
        router.push('/projects')
      } catch (e: any) {
        toast(e.message, 'error')
      }
    })
  }

  const isOverdue = ['enquiry','quoted','confirmed','in_production','in_post','review','revisions','final_delivery'].includes(project.status) && project.deadline < today

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">

      {/* Revision warning */}
      {revisionWarning && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          <AlertTriangle size={18} className="text-yellow-600 shrink-0" />
          <p>This project has exceeded the included revision rounds ({includedRounds} included, {revisionCount} logged). Consider adding a revision charge.</p>
        </div>
      )}

      {/* Project header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={getStatusBadgeClass(project.status)}>{getStatusConfig(project.status).label}</Badge>
            {isOverdue && <Badge className="bg-red-100 text-red-700"><AlertTriangle size={12} className="inline mr-1" />Overdue</Badge>}
          </div>
          <div className="mt-2 text-sm text-gray-600 space-y-0.5">
            <p><span className="font-medium">{project.companyName}</span> · {project.clientName}</p>
            <p>Start: {formatDate(project.startDate)} · Deadline: <span className={isOverdue ? 'text-red-600 font-medium' : ''}>{formatDate(project.deadline)}</span></p>
            {project.drivefinalsLink && <a href={project.drivefinalsLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs"><ExternalLink size={12} />Finals Drive</a>}
            {project.driveArchiveLink && <a href={project.driveArchiveLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs ml-3"><ExternalLink size={12} />Archive</a>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditProjectOpen(true)} disabled={isLocked}>
            <Edit size={14} /> Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setDeleteProjectConfirm(true)} disabled={isLocked}>
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </div>

      {/* Status pipeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Status Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PROJECT_STATUSES.map(s => (
              <button
                key={s.key}
                onClick={() => handleStatusChange(s.key)}
                disabled={s.key === project.status}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border
                  ${s.key === project.status
                    ? 'ring-2 ring-offset-1 ring-[#1e3a5f] ' + getStatusBadgeClass(s.key)
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {project.notes && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-gray-700 whitespace-pre-wrap">{project.notes}</p></CardContent>
        </Card>
      )}

      {/* Summary cards 2×2 grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Frame.io */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
              <Film size={15} /> Frame.io
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between gap-3">
            {frameioLinked ? (
              <>
                <p className="text-sm text-gray-700">Project linked</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/projects/${project.id}/frameio`}>
                    <Button size="sm" variant="outline">Browse assets <ChevronRight size={13} /></Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    disabled={unlinkingFrameio}
                    onClick={async () => {
                      setUnlinkingFrameio(true)
                      await unlinkFrameioProject(project.id)
                      setFrameioLinked(false)
                      setUnlinkingFrameio(false)
                      router.refresh()
                    }}
                  >
                    {unlinkingFrameio ? <Loader2 size={13} className="animate-spin" /> : 'Unlink'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-400">No project linked</p>
                <Button size="sm" variant="outline" onClick={() => setFrameioLinkOpen(true)}>
                  Link Frame.io Project
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Deliverables */}
        <Link href={`/projects/${project.id}/deliverables`} className="block">
          <Card className="h-full hover:border-[#1e3a5f] hover:shadow-sm transition-all cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                <Package size={15} /> Deliverables
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{deliverableCount}</p>
                <p className="text-xs text-gray-500">{deliverableCount === 1 ? 'deliverable' : 'deliverables'}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-gray-800">{formatCurrency(deliverableTotal)}</p>
                <ChevronRight size={16} className="ml-auto text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Shoot Details */}
        <Link href={`/projects/${project.id}/shoots`} className="block">
          <Card className="h-full hover:border-[#1e3a5f] hover:shadow-sm transition-all cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                <Camera size={15} /> Shoot Details
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{shootCount}</p>
                <p className="text-xs text-gray-500">{shootCount === 1 ? 'shoot day' : 'shoot days'}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-gray-800">{formatCurrency(shootTotal)}</p>
                <ChevronRight size={16} className="ml-auto text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Revisions */}
        <Link href={`/projects/${project.id}/revisions`} className="block">
          <Card className={`h-full hover:border-[#1e3a5f] hover:shadow-sm transition-all cursor-pointer ${revisionWarning ? 'border-yellow-300' : ''}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                <RotateCcw size={15} /> Revisions
                {revisionWarning && <AlertTriangle size={14} className="text-yellow-600" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{revisionCount}</p>
                <p className="text-xs text-gray-500">{includedRounds} included</p>
              </div>
              <ChevronRight size={16} className="text-gray-400" />
            </CardContent>
          </Card>
        </Link>

      </div>

      {/* Project Total */}
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardContent className="py-6">
          <div className="flex items-center justify-between text-white">
            <div>
              <p className="text-white/70 text-sm">Project Total (Invoiceable Amount)</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(projectTotal)}</p>
            </div>
            <div className="text-right text-sm text-white/70 space-y-1">
              <p>Deliverables: {formatCurrency(deliverableTotal)}</p>
              {shootTotal > 0 && <p>Shoot: {formatCurrency(shootTotal)}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <Dialog open={editProjectOpen} onClose={() => setEditProjectOpen(false)} title="Edit Project" className="max-w-2xl">
        <EditProjectForm
          project={project}
          companies={companies}
          clients={clients}
          onSave={fd => { updateProject(project.id, fd).then(() => { toast('Project updated'); setEditProjectOpen(false); router.refresh() }) }}
          onClose={() => setEditProjectOpen(false)}
        />
      </Dialog>

      <ConfirmDialog
        open={deleteProjectConfirm}
        onClose={() => setDeleteProjectConfirm(false)}
        onConfirm={handleDeleteProject}
        title="Delete Project"
        message="This will permanently delete this project and all its deliverables, shoot details, and revisions. This cannot be undone."
        confirmLabel="Delete Project"
      />

      <FrameioLinkDialog
        open={frameioLinkOpen}
        onClose={() => setFrameioLinkOpen(false)}
        onLinked={() => { setFrameioLinkOpen(false); setFrameioLinked(true); router.refresh() }}
        projectId={project.id}
      />

    </div>
  )
}
