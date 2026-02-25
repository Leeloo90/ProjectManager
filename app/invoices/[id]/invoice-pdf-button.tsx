'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

export function InvoicePDFButton({ invoice, linkedProjects, projectDetails, settings }: {
  invoice: any; linkedProjects: any[]; projectDetails: Record<string, { deliverables: any[]; shoot: any | null }>; settings: any
}) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const [{ pdf }, { InvoicePDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./invoice-pdf'),
      ])
      const logoUrl = window.location.origin + '/logo.png'
      const element = InvoicePDF({ invoice, linkedProjects, projectDetails, settings, logoUrl })
      const blob = await pdf(element).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${invoice.invoiceNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" onClick={handleDownload} disabled={loading}>
      <Download size={15} /> {loading ? 'Generating...' : 'Export PDF'}
    </Button>
  )
}
