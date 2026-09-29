// NextAuth parses NEXTAUTH_URL as soon as its client module is imported.
// Vercel may define detected environment variables with an empty value, which
// makes that import throw ERR_INVALID_URL during static page generation.
const configuredSiteUrl = [
  process.env.NEXTAUTH_URL,
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.NEXT_PUBLIC_APP_URL,
]
  .map((value) => value?.trim())
  .find(Boolean)

if (!process.env.NEXTAUTH_URL?.trim()) {
  process.env.NEXTAUTH_URL = configuredSiteUrl
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.paypal.com https://js.stripe.com https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.stripe.com https://*.paypal.com https://nominatim.openstreetmap.org https://www.google-analytics.com https://*.google-analytics.com",
              "frame-src 'self' https://js.stripe.com https://www.paypal.com",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
