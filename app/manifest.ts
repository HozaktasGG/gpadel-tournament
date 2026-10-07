import type { MetadataRoute } from 'next'

// Served at /manifest.webmanifest. Ready for web push later (needs a service worker; not added yet).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'SmashTorino — Padel Community of Torino',
    short_name: 'SmashTorino',
    description: 'Padel tournaments, live scores and rankings in Turin.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a1f19',
    theme_color: '#1a3d2e',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
