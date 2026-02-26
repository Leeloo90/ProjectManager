'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Mail, MailOpen, Settings, AlertTriangle, ChevronDown, ChevronUp, RefreshCw, ExternalLink } from 'lucide-react'
import Link from 'next/link'

type EmailMeta = {
  id: string
  subject: string
  from: string
  to: string
  date: string
  snippet: string
}

type EmailBody = {
  html: string | null
  plain: string | null
}

function formatEmailDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('en-ZA', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function parseSender(from: string): { name: string; email: string } {
  const match = from.match(/^(.*?)\s*<(.+?)>$/)
  if (match) return { name: match[1].replace(/"/g, '').trim(), email: match[2] }
  return { name: '', email: from }
}

function EmailRow({ email, labelName }: { email: EmailMeta; labelName: string }) {
  const [expanded, setExpanded] = useState(false)
  const [body, setBody] = useState<EmailBody | null>(null)
  const [loadingBody, setLoadingBody] = useState(false)

  async function toggle() {
    if (!expanded && !body) {
      setLoadingBody(true)
      try {
        const res = await fetch(`/api/gmail/emails?label=${encodeURIComponent(labelName)}&full=${email.id}`)
        if (res.ok) {
          const data = await res.json()
          setBody(data)
        }
      } finally {
        setLoadingBody(false)
      }
    }
    setExpanded(prev => !prev)
  }

  const { name, email: addr } = parseSender(email.from)

  return (
    <div className="border-b border-gray-100 last:border-0">
      <div className="flex items-stretch">
        <button
          onClick={toggle}
          className="flex-1 text-left px-6 py-4 hover:bg-gray-50 transition-colors min-w-0"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="mt-0.5 shrink-0 text-gray-400">
                {expanded ? <MailOpen size={16} /> : <Mail size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 text-sm">
                    {name || addr}
                  </span>
                  {name && (
                    <span className="text-xs text-gray-400">{addr}</span>
                  )}
                </div>
                <p className="font-semibold text-gray-800 text-sm mt-0.5 truncate">{email.subject}</p>
                {!expanded && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{email.snippet}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-400 whitespace-nowrap">{formatEmailDate(email.date)}</span>
              {loadingBody
                ? <Loader2 size={14} className="animate-spin text-gray-400" />
                : expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />
              }
            </div>
          </div>
        </button>
        <a
          href={`https://mail.google.com/mail/u/0/#all/${email.id}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in Gmail"
          onClick={e => e.stopPropagation()}
          className="flex items-center px-3 text-gray-300 hover:text-blue-500 hover:bg-gray-50 transition-colors border-l border-gray-100"
        >
          <ExternalLink size={14} />
        </a>
      </div>

      {expanded && (
        <div className="px-6 pb-5">
          <div className="text-xs text-gray-400 mb-3 space-y-0.5">
            <p><span className="font-medium text-gray-500">From:</span> {email.from}</p>
            <p><span className="font-medium text-gray-500">To:</span> {email.to}</p>
            <p><span className="font-medium text-gray-500">Date:</span> {formatEmailDate(email.date)}</p>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            {loadingBody ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={20} className="animate-spin text-gray-400" />
              </div>
            ) : body?.html ? (
              <iframe
                srcDoc={body.html}
                sandbox="allow-same-origin"
                className="w-full min-h-64 border-0"
                style={{ height: '400px' }}
                title={email.subject}
              />
            ) : body?.plain ? (
              <pre className="text-sm text-gray-700 p-4 whitespace-pre-wrap font-sans leading-relaxed">
                {body.plain}
              </pre>
            ) : (
              <p className="text-sm text-gray-400 p-4 italic">No readable content.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function EmailListClient({
  projectId,
  projectName,
  labelName,
  isConnected,
}: {
  projectId: string
  projectName: string
  labelName: string
  isConnected: boolean
}) {
  const [emails, setEmails] = useState<EmailMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [labelNotFound, setLabelNotFound] = useState(false)

  async function fetchEmails() {
    setLoading(true)
    setError(null)
    setLabelNotFound(false)
    try {
      const res = await fetch(`/api/gmail/emails?label=${encodeURIComponent(labelName)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.details ?? data.error ?? 'Failed to fetch emails')
        return
      }
      if (data.labelNotFound) {
        setLabelNotFound(true)
        setEmails([])
        return
      }
      setEmails(data.emails ?? [])
    } catch {
      setError('Network error — could not reach the server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isConnected) fetchEmails()
  }, [labelName, isConnected])

  // ── Not connected ────────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Mail size={24} className="text-gray-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">Gmail not connected</p>
              <p className="text-sm text-gray-500 mt-1">
                Connect your Gmail account in Settings to view project emails.
              </p>
            </div>
            <Link href="/settings">
              <Button variant="outline"><Settings size={14} /> Go to Settings</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Connected ────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            Showing emails labelled <span className="font-medium text-gray-700">"{labelName}"</span> in Gmail
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchEmails} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      <Card>
        {loading && (
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </CardContent>
        )}

        {!loading && error && (
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <AlertTriangle size={20} className="text-red-400" />
            <p className="text-sm text-red-600">{error}</p>
            <Button size="sm" variant="outline" onClick={fetchEmails}>Try Again</Button>
          </CardContent>
        )}

        {!loading && !error && labelNotFound && (
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <Mail size={20} className="text-gray-300" />
            <p className="font-medium text-gray-600">No Gmail label found</p>
            <p className="text-sm text-gray-400">
              Create a label named <span className="font-mono text-gray-600">"{labelName}"</span> in Gmail
              and apply it to the relevant emails.
            </p>
          </CardContent>
        )}

        {!loading && !error && !labelNotFound && emails.length === 0 && (
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <Mail size={20} className="text-gray-300" />
            <p className="font-medium text-gray-600">No emails found</p>
            <p className="text-sm text-gray-400">
              No emails have been labelled <span className="font-mono text-gray-600">"{labelName}"</span> yet.
            </p>
          </CardContent>
        )}

        {!loading && !error && emails.length > 0 && (
          <div className="divide-y divide-gray-100">
            {emails.map(email => (
              <EmailRow key={email.id} email={email} labelName={labelName} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
