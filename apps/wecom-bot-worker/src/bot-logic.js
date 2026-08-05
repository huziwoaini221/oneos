export function buildSubscribe(botId, secret) {
  return {
    cmd: 'aibot_subscribe',
    headers: { req_id: crypto.randomUUID() },
    body: { bot_id: botId, secret }
  }
}

export function buildPing() {
  return { cmd: 'ping', headers: { req_id: crypto.randomUUID() } }
}

export function buildReply(frame, loginUrl) {
  const body = frame.body
  if (frame.cmd !== 'aibot_msg_callback') return null
  if (body?.msgtype !== 'text') return null
  const content = body.text?.content || ''
  if (!/登陆|登录|login/i.test(content)) return null
  return {
    cmd: 'aibot_respond_msg',
    headers: { req_id: frame.headers?.req_id ?? '' },
    body: {
      msgtype: 'markdown',
      markdown: { content: `点击打开 LifeHub：[登录链接](${loginUrl})` }
    }
  }
}
