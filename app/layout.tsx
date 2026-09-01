import './globals.css'
import type { Metadata } from 'next'
import Script from 'next/script'
import { Providers } from './providers'
import { GlobalSignOutButton } from '@/components/GlobalSignOutButton'
import { getSiteUrl } from '@/lib/siteUrl'
import { CONTACT_INFO, LOGO_URL } from '@/components/monchantier/constants'

const siteUrl = getSiteUrl()
const title = "MonChantier - Vente d'agrégats en ligne"
const description = "Achetez matériaux de construction et services (livraison, maçonnerie, plomberie...) en ligne à Kolwezi, RDC. Paiement Mobile Money, carte et PayPal."

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: '%s — MonChantier',
  },
  description,
  keywords: [
    'matériaux de construction Kolwezi',
    'agrégats RDC',
    'briques ciment sable',
    'services construction RDC',
    'MonChantier',
  ],
  icons: {
    icon: LOGO_URL,
    shortcut: LOGO_URL,
    apple: LOGO_URL,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'fr_CD',
    url: siteUrl,
    siteName: 'MonChantier',
    title,
    description,
    images: [{ url: LOGO_URL }],
  },
  twitter: {
    card: 'summary',
    title,
    description,
    images: [LOGO_URL],
  },
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HardwareStore',
  name: 'MonChantier',
  url: siteUrl,
  logo: `${siteUrl}${LOGO_URL}`,
  image: `${siteUrl}${LOGO_URL}`,
  telephone: CONTACT_INFO.whatsapp,
  email: CONTACT_INFO.email,
  address: {
    '@type': 'PostalAddress',
    streetAddress: CONTACT_INFO.address,
    addressCountry: 'CD',
  },
}

const gaId = process.env.NEXT_PUBLIC_GA_ID

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {gaId && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
            <Script id="ga-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        )}
        <Providers>
          {children}
          <GlobalSignOutButton />
        </Providers>
      </body>
    </html>
  )
}
