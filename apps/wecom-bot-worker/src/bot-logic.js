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

export function buildReply(frame, lifehubUrl, keshijiluUrl, vaultliteUrl) {
  const body = frame.body
  if (frame.cmd !== 'aibot_msg_callback') return null
  if (body?.msgtype !== 'text') return null
  const content = body.text?.content || ''
  if (/课时|账本|ksjl|打卡/i.test(content)) {
    return {
      cmd: 'aibot_respond_msg',
      headers: { req_id: frame.headers?.req_id ?? '' },
      body: {
        msgtype: 'markdown',
        markdown: { content: `点击打开 课时账本：[打开](${keshijiluUrl})` }
      }
    }
  }
  if (/保险库|vault|otp|验证码/i.test(content)) {
    return {
      cmd: 'aibot_respond_msg',
      headers: { req_id: frame.headers?.req_id ?? '' },
      body: {
        msgtype: 'markdown',
        markdown: { content: `点击打开 VaultLite：[打开](${vaultliteUrl})` }
      }
    }
  }
  if (!/登陆|登录|login/i.test(content)) return null
  return {
    cmd: 'aibot_respond_msg',
    headers: { req_id: frame.headers?.req_id ?? '' },
    body: {
      msgtype: 'markdown',
      markdown: { content: `点击打开 LifeHub：[登录链接](${lifehubUrl})` }
    }
  }
}
