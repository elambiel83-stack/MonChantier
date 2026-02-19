import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'MonChantier - Vente d\'agrégats en ligne',
  description: 'Construction materials e-commerce platform based in Kolwezi',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
