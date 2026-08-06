import { buildSubscribe, buildPing, buildReply } from './bot-logic.js'

const WS_URL = 'wss://openws.work.weixin.qq.com'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const stub = env.WECOM_BOT.get(env.WECOM_BOT.idFromName('main'))
    if (url.pathname === '/api/wecom/status') {
      return stub.fetch('http://internal/status')
    }
    await stub.fetch('http://internal/connect')
    return new Response('ok')
  },

  async scheduled(controller, env) {
    const stub = env.WECOM_BOT.get(env.WECOM_BOT.idFromName('main'))
    await stub.fetch('http://internal/connect')
  }
}

export class WecomBot {
  constructor(state, env) {
    this.state = state
    this.env = env
    this.ws = null
    this.diag = {
      attempts: 0,
      lastConnectError: null,
      opened: false,
      subscribed: false,
      lastCloseCode: null,
      lastCloseReason: '',
      lastMessageAt: null
    }
  }

  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/status') {
      return new Response(
        JSON.stringify({
          connected: this.ws?.readyState === WebSocket.OPEN,
          readyState: this.ws?.readyState ?? -1,
          diag: this.diag
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }
    await this.ensureConnected()
    return new Response('ok')
  }

  async ensureConnected() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return
    this.diag.attempts++
    let sock
    try {
      sock = new WebSocket(WS_URL)
    } catch (e) {
      this.diag.lastConnectError = String(e?.message || e)
      console.error('[wecom] connect error:', this.diag.lastConnectError)
      await this.scheduleReconnect(15000)
      return
    }
    this.ws = sock
    sock.addEventListener('open', () => {
      this.diag.opened = true
      this.diag.lastConnectError = null
      console.log('[wecom] ws open, subscribing')
      sock.send(JSON.stringify(buildSubscribe(this.env.WECOM_BOT_ID, this.env.WECOM_BOT_SECRET)))
      this.state.storage.setAlarm(Date.now() + 30000)
    })
    sock.addEventListener('message', (event) => {
      this.diag.lastMessageAt = Date.now()
      this.diag.lastFrame = String(event.data).slice(0, 500)
      this.handle(event.data)
    })
    sock.addEventListener('close', (e) => {
      this.diag.lastCloseCode = e?.code ?? null
      this.diag.lastCloseReason = e?.reason ?? ''
      console.log('[wecom] ws closed', this.diag.lastCloseCode, this.diag.lastCloseReason)
      this.ws = null
      this.scheduleReconnect(10000)
    })
    sock.addEventListener('error', () => {
      console.log('[wecom] ws error')
    })
  }

  async handle(data) {
    let frame
    try {
      frame = JSON.parse(data)
    } catch {
      return
    }
    if (frame.cmd === 'aibot_subscribe' || frame.errcode !== undefined) {
      this.diag.subscribed = frame.errcode === 0
      console.log('[wecom] ack:', frame.errcode, frame.errmsg)
    }
    const reply = buildReply(
      frame,
      `https://oneos.dpdns.org/?key=${this.env.LIFEHUB_TOKEN}`,
      `https://keshijilu.pages.dev/?key=${this.env.KESHIJILU_TOKEN}`,
      `https://vaultlite.pages.dev/?key=${this.env.VAULTLITE_TOKEN}`,
      `https://biji-ev8.pages.dev/?key=${this.env.KESHIJILU_TOKEN}`
    )
    if (reply) {
      try {
        this.ws?.send(JSON.stringify(reply))
        console.log('[wecom] replied login link')
      } catch (e) {
        console.error('[wecom] reply error:', e)
      }
    }
  }

  async scheduleReconnect(ms) {
    await this.state.storage.setAlarm(Date.now() + ms)
  }

  async alarm() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(buildPing()))
      } catch (e) {
        console.error('[wecom] ping error:', e)
        this.ws = null
      }
      await this.state.storage.setAlarm(Date.now() + 30000)
    } else {
      await this.ensureConnected()
    }
  }
}
