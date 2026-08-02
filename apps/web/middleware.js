import { NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/api/telegram']

export function middleware(request) {
  const url = new URL(request.url)
  
  // Telegram webhook 放行
  if (PUBLIC_PATHS.some(p => url.pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // API 路由鉴权
  if (url.pathname.startsWith('/api/')) {
    const auth = request.headers.get('Authorization')
    const token = process.env.LIFEHUB_TOKEN
    if (!token || auth !== `Bearer ${token}`) {
      return new NextResponse(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*']
}