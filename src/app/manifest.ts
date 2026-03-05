import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AI Daily Planner',
    short_name: 'Planner',
    description: 'Intelligent AI-driven daily planner and knowledge base',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
      // 실제 배포 시에는 192x192, 512x512 크기의 PNG 아이콘을 public 폴더에 넣는 것이 좋습니다.
    ],
  }
}
