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
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
      {
        src: '/icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      }
    ],
  }
}
