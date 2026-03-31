import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NEON GENESIS ARCHIVE',
    short_name: 'ARCHIVE',
    description: 'Advanced MAGI Protocol - Neural Interface Planner',
    start_url: '/',
    display: 'standalone',
    background_color: '#050505',
    theme_color: '#a78bfa',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      }
    ],
  }
}
