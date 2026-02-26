import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/sidebar'
import { ToastProvider } from '@/components/ui/toast'
import { initDB } from './init-db'
import Script from 'next/script'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Ambient Arts — Project Manager',
  description: 'Project & Business Management for Ambient Arts',
}

initDB()

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50`}>
        {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
          <Script
            src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`}
            strategy="afterInteractive"
          />
        )}
        <ToastProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {children}
            </main>
          </div>
        </ToastProvider>
      </body>
    </html>
  )
}
