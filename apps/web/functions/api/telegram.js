// Telegram webhook 入站：/start 绑定 chat_id；callback_query 处理任务完成按钮。
// 部署后调用 setWebhook 指向 /telegram，并设置 secret_token。

export async function onRequestPost({ request, env }) {
  const secretHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token')
  if (secretHeader && env.TELEGRAM_WEBHOOK_SECRET && secretHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('unauthorized', { status: 401 })
  }

  const token = env.TELEGRAM_BOT_TOKEN
  const update = await request.json().catch(() => null)
  if (!update) return new Response('ok')

  if (update.message && update.message.text === '/start') {
    const chatId = String(update.message.chat.id)
    await env.DB.prepare(
      'UPDATE settings SET telegram_chat_id = ?, telegram_enabled = 1 WHERE id = 1'
    ).bind(chatId).run()
    await sendText(token, chatId, 'LifeHub 已绑定，提醒将推送到这里。\n发送 /login 获取网页访问链接。')
    return new Response('ok')
  }

  if (update.message && update.message.text === '/login') {
    const chatId = String(update.message.chat.id)
    const row = await env.DB.prepare('SELECT telegram_chat_id FROM settings WHERE id = 1').first()
    if (!row || String(row.telegram_chat_id) !== chatId) {
      await sendText(token, chatId, '未绑定。请先发送 /start 绑定。')
      return new Response('ok')
    }
    const origin = new URL(request.url).origin
    await sendText(token, chatId, `🔑 网页访问链接：\n${origin}/?key=${env.LIFEHUB_TOKEN}\n\n请妥善保管，勿转发给他人。`)
    return new Response('ok')
  }

  if (update.callback_query) {
    const q = update.callback_query
    const chatId = q.message && q.message.chat.id
    const data = q.data || ''
    if (data.startsWith('task_complete:')) {
      const taskId = data.split(':')[1]
      await env.DB.prepare(
        "UPDATE tasks SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?"
      ).bind(new Date().toISOString(), new Date().toISOString(), taskId).run()
      if (chatId) await sendText(token, String(chatId), `任务 #${taskId} 已完成。`)
    }
    return new Response('ok')
  }

  return new Response('ok')
}

async function sendText(token, chatId, text) {
  if (!token) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: Number(chatId), text })
  })
}
