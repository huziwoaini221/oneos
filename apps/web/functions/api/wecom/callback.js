// 企微回调：支持 智能机器人(JSON) 与 自建应用(XML) 两种协议。
// URL 验证：GET；消息/事件：POST。加解密同 AES-256-CBC（key=base64(EncodingAESKey)，IV=key 前 16 字节）。
// 明文结构：random(16B) + msgLen(4B 大端) + msg + receiveid（智能机器人为空字符串）。
// 签名：sha1( 字典序 [token, timestamp, nonce, encrypt].join('') )。

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const msg_signature = url.searchParams.get('msg_signature')
  const timestamp = url.searchParams.get('timestamp')
  const nonce = url.searchParams.get('nonce')
  const token = env.WECOM_CALLBACK_TOKEN
  const aesKey = env.WECOM_AES_KEY

  if (!msg_signature || !timestamp || !nonce || !token || !aesKey) {
    return new Response('bad request', { status: 400 })
  }

  // echostr 可能被 URL 编码，做多级兜底：已解码值 / 原始值 / 再解一次
  const decoded = url.searchParams.get('echostr')
  const raw = getRawQueryParam(url, 'echostr')
  const candidates = []
  for (const c of [decoded, raw, decoded ? safeDecode(decoded) : null, raw ? safeDecode(raw) : null]) {
    if (c && !candidates.includes(c)) candidates.push(c)
  }

  for (const cand of candidates) {
    if (await verifySignature(token, timestamp, nonce, cand, msg_signature)) {
      // 签名基于编码值（若被编码），解密需用解码一次后的值
      const msg = await decrypt(safeDecode(cand), aesKey)
      if (msg !== null) return new Response(msg)
    }
  }
  return new Response('verify failed', { status: 403 })
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url)
  const msg_signature = url.searchParams.get('msg_signature')
  const timestamp = url.searchParams.get('timestamp')
  const nonce = url.searchParams.get('nonce')
  const token = env.WECOM_CALLBACK_TOKEN
  const aesKey = env.WECOM_AES_KEY

  const raw = await request.text().catch(() => '')
  const encPayload = extractEncrypt(raw)
  if (!msg_signature || !timestamp || !nonce || !encPayload || !token || !aesKey) {
    return new Response('', { status: 200 })
  }
  if (!(await verifySignature(token, timestamp, nonce, encPayload, msg_signature))) {
    return new Response('', { status: 403 })
  }

  const plain = await decrypt(encPayload, aesKey)
  if (plain === null) return new Response('', { status: 200 })

  if (plain.trimStart().startsWith('{')) {
    return handleAibotJson(plain, request, env, aesKey, token, nonce)
  }
  return handleAppXml(plain, request, env, aesKey, token)
}

// ---- 智能机器人（JSON 协议） ----
async function handleAibotJson(plain, request, env, aesKey, token, nonce) {
  let msg
  try {
    msg = JSON.parse(plain)
  } catch {
    return new Response('', { status: 200 })
  }
  const msgType = msg.msgtype || ''
  if (msgType === 'text') {
    const content = ((msg.text && msg.text.content) || '').trim()
    if (/登陆|登录|login/i.test(content)) {
      const origin = new URL(request.url).origin
      const loginUrl = `${origin}/?key=${env.LIFEHUB_TOKEN}`
      const reply = JSON.stringify({ msgtype: 'text', text: { content: loginUrl } })
      const encrypted = await encrypt(reply, aesKey, '')
      if (encrypted === null) return new Response('', { status: 200 })
      return new Response(await aibotReplyEnvelope(encrypted, token, nonce), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
  return new Response('', { status: 200 })
}

async function aibotReplyEnvelope(encrypt, token, nonce) {
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = await sha1Hex([token, String(timestamp), nonce, encrypt].sort().join(''))
  return JSON.stringify({ encrypt, msgsignature: signature, timestamp, nonce })
}

// ---- 自建应用（XML 协议） ----
async function handleAppXml(plain, request, env, aesKey, token) {
  const xml = parseXml(plain)
  const msgType = xml.MsgType || ''
  const content = (xml.Content || '').trim()
  const from = xml.FromUserName || ''
  const to = xml.ToUserName || ''

  if (msgType === 'text' && /登陆|登录|login/i.test(content)) {
    const origin = new URL(request.url).origin
    const loginUrl = `${origin}/?key=${env.LIFEHUB_TOKEN}`
    const replyXml = textReplyXml(from, to, loginUrl)
    const encrypted = await encrypt(replyXml, aesKey, to)
    if (encrypted === null) return new Response('', { status: 200 })
    return new Response(await xmlReplyEnvelope(encrypted, token))
  }
  return new Response('', { status: 200 })
}

async function xmlReplyEnvelope(encrypt, token) {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const nonce = randomNonce()
  const signature = await sha1Hex([token, timestamp, nonce, encrypt].sort().join(''))
  return (
    `<xml><Encrypt><![CDATA[${encrypt}]]></Encrypt>` +
    `<MsgSignature><![CDATA[${signature}]]></MsgSignature>` +
    `<TimeStamp>${timestamp}</TimeStamp>` +
    `<Nonce><![CDATA[${nonce}]]></Nonce></xml>`
  )
}

// ---- 通用工具 ----

function getRawQueryParam(url, name) {
  const qs = url.search.replace(/^\?/, '')
  for (const pair of qs.split('&')) {
    const eq = pair.indexOf('=')
    if (eq === -1) continue
    if (pair.slice(0, eq) === name) return pair.slice(eq + 1)
  }
  return null
}

function safeDecode(str) {
  try {
    return decodeURIComponent(str)
  } catch {
    return str
  }
}

function extractEncrypt(raw) {
  if (raw.trimStart().startsWith('{')) {
    try {
      const j = JSON.parse(raw)
      return j.encrypt || ''
    } catch {
      return ''
    }
  }
  return xmlGet(raw, 'Encrypt')
}

function parseXml(xml) {
  const tags = ['ToUserName', 'FromUserName', 'CreateTime', 'MsgType', 'Content', 'MsgId', 'AgentID', 'Event', 'EventKey', 'TaskId', 'ChatId', 'ChatType']
  const out = {}
  for (const t of tags) out[t] = xmlGet(xml, t)
  return out
}

function xmlGet(xml, tag) {
  const cdata = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`).exec(xml)
  if (cdata) return cdata[1]
  const plain = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml)
  return plain ? plain[1] : ''
}

function textReplyXml(toUser, fromUser, content) {
  const time = Math.floor(Date.now() / 1000)
  return (
    `<xml><ToUserName><![CDATA[${toUser}]]></ToUserName>` +
    `<FromUserName><![CDATA[${fromUser}]]></FromUserName>` +
    `<CreateTime>${time}</CreateTime>` +
    `<MsgType><![CDATA[text]]></MsgType>` +
    `<Content><![CDATA[${content}]]></Content></xml>`
  )
}

async function verifySignature(token, timestamp, nonce, encrypt, expected) {
  const sig = await sha1Hex([token, timestamp, nonce, encrypt].sort().join(''))
  return sig === expected
}

function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function toBytes(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function toBase64(bytes) {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

async function sha1Hex(str) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function importAesKey(aesKey, usage) {
  const keyBytes = toBytes(aesKey + '=')
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, [usage])
  return { key, iv: keyBytes.slice(0, 16) }
}

async function decrypt(encryptB64, aesKey) {
  try {
    const { key, iv } = await importAesKey(aesKey, 'decrypt')
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, toBytes(encryptB64)))
    const len = (plain[16] << 24) | (plain[17] << 16) | (plain[18] << 8) | plain[19]
    return new TextDecoder().decode(plain.slice(20, 20 + len))
  } catch {
    return null
  }
}

async function encrypt(msg, aesKey, receiveId) {
  try {
    const { key, iv } = await importAesKey(aesKey, 'encrypt')
    const msgBytes = new TextEncoder().encode(msg)
    const receiveBytes = new TextEncoder().encode(receiveId || '')
    const len = new Uint8Array(4)
    len[0] = (msgBytes.length >> 24) & 0xff
    len[1] = (msgBytes.length >> 16) & 0xff
    len[2] = (msgBytes.length >> 8) & 0xff
    len[3] = msgBytes.length & 0xff
    const plain = new Uint8Array(16 + 4 + msgBytes.length + receiveBytes.length)
    plain.set(crypto.getRandomValues(new Uint8Array(16)), 0)
    plain.set(len, 16)
    plain.set(msgBytes, 20)
    plain.set(receiveBytes, 20 + msgBytes.length)
    const cipher = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, plain)
    return toBase64(new Uint8Array(cipher))
  } catch {
    return null
  }
}
