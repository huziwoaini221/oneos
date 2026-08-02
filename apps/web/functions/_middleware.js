// 全局鉴权中间件：所有 /api/* 请求需携带 Bearer <LIFEHUB_TOKEN>。
// 放行：telegram（webhook 自带 secret_token 校验）、cron（自带 CRON_SECRET 校验）。

export async function onRequest(context) {
  const { request, env, next } = context
  const url = new URL(request.url)

  if (!url.pathname.startsWith('/api/')) return next()

  const path = url.pathname
  if (path.startsWith('/api/telegram') || path.startsWith('/api/cron')) return next()

  const auth = request.headers.get('Authorization')
  if (auth !== `Bearer ${env.LIFEHUB_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  return next()
}
