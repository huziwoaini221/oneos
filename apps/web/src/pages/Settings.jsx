import { useEffect, useState, useCallback } from 'react'
import { get, patch } from '../api.js'

export default function Settings() {
  const [settings, setSettings] = useState({
    timezone: 'Asia/Shanghai',
    telegram_chat_id: '',
    telegram_enabled: 1,
    default_channel: 'telegram',
    weather_city: '',
    wecom_webhook: '',
    wecom_enabled: 0,
    lifehub_token: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [showToken, setShowToken] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setDeferredPrompt(null)
  }

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const s = await get('/api/settings')
      setSettings({ ...settings, ...(s || {}), lifehub_token: '' })
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage({ type: '', text: '' })
    const payload = {
      timezone: settings.timezone,
      telegram_chat_id: settings.telegram_chat_id || null,
      telegram_enabled: settings.telegram_enabled ? 1 : 0,
      default_channel: settings.default_channel,
      weather_city: settings.weather_city || null,
      wecom_webhook: settings.wecom_webhook || null,
      wecom_enabled: settings.wecom_enabled ? 1 : 0
    }
    try {
      await patch('/api/settings', payload)
      setMessage({ type: 'success', text: '保存成功' })
      fetchSettings()
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    } finally { setSaving(false) }
  }

  const testTelegram = async () => {
    if (!settings.telegram_chat_id) { setMessage({ type: 'error', text: '请先绑定 chat_id' }); return }
    try {
      const res = await fetch('/api/settings/test-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: settings.telegram_chat_id, text: 'LifeHub 测试消息' })
      })
      if (res.ok) setMessage({ type: 'success', text: '测试消息已发送' })
      else setMessage({ type: 'error', text: '发送失败，检查 Bot Token 与 chat_id' })
    } catch (e) { setMessage({ type: 'error', text: e.message }) }
  }

  if (loading) return <div className="loading">加载中...</div>

  return (
    <section>
      <h1>系统设置</h1>
      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      <form onSubmit={handleSave}>
        <div className="card">
          <h2>时区与基础</h2>
          <div className="field">
            <label>时区 *</label>
            <select value={settings.timezone} onChange={e => setSettings({ ...settings, timezone: e.target.value })}>
              <option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
              <option value="Asia/Hong_Kong">Asia/Hong_Kong (UTC+8)</option>
              <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York (UTC-5/-4)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (UTC-8/-7)</option>
              <option value="Europe/London">Europe/London (UTC+0/+1)</option>
              <option value="Europe/Paris">Europe/Paris (UTC+1/+2)</option>
            </select>
          </div>
          <div className="field">
            <label>默认提醒渠道</label>
            <select value={settings.default_channel} onChange={e => setSettings({ ...settings, default_channel: e.target.value })}>
              <option value="telegram">Telegram</option>
              <option value="wecom">企业微信</option>
              <option value="telegram,wecom">Telegram + 企业微信</option>
            </select>
          </div>
          <div className="field">
            <label>天气城市</label>
            <input
              value={settings.weather_city || ''}
              onChange={e => setSettings({ ...settings, weather_city: e.target.value })}
              placeholder="如：Shanghai / Beijing / Chengdu"
            />
            <p className="hint">Dashboard 天气卡片将显示该城市的实时天气（wttr.in，无需 API Key）。</p>
          </div>
        </div>

        <div className="card">
          <h2>Telegram Bot</h2>
          <div className="field">
            <label>Bot Token</label>
            <div className="input-with-toggle">
              <input
                type={showToken ? 'text' : 'password'}
                value={settings.lifehub_token || ''}
                readOnly
                placeholder="配置在 Cloudflare Secret (TELEGRAM_BOT_TOKEN)"
              />
              <button type="button" className="btn small secondary" onClick={() => setShowToken(!showToken)}>
                {showToken ? '隐藏' : '显示'}
              </button>
            </div>
            <p className="hint">Token 存储在 Cloudflare Secret 中，不保存在数据库。前端仅显示占位。</p>
          </div>
          <div className="field">
            <label>Chat ID</label>
            <input
              value={settings.telegram_chat_id}
              onChange={e => setSettings({ ...settings, telegram_chat_id: e.target.value })}
              placeholder="发送 /start 给 Bot 自动获取"
            />
            <p className="hint">在 Telegram 给 Bot 发送 /start 后，系统自动记录 chat_id；也可手动填入。</p>
          </div>
          <div className="field">
            <label>启用 Telegram 推送</label>
            <select value={settings.telegram_enabled} onChange={e => setSettings({ ...settings, telegram_enabled: parseInt(e.target.value) })}>
              <option value={1}>启用</option>
              <option value={0}>禁用</option>
            </select>
          </div>
          <div className="field-actions">
            <button type="button" className="btn secondary" onClick={testTelegram}>发送测试消息</button>
          </div>
        </div>

        <div className="card">
          <h2>企业微信</h2>
          <div className="field">
            <label>群机器人 Webhook</label>
            <input value={settings.wecom_webhook || ''} onChange={e => setSettings({ ...settings, wecom_webhook: e.target.value })} placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..." />
            <p className="hint">在企业微信群 → 群设置 → 群机器人 → 添加机器人后复制 Webhook 地址。</p>
          </div>
          <div className="field">
            <label>启用企业微信推送</label>
            <select value={settings.wecom_enabled} onChange={e => setSettings({ ...settings, wecom_enabled: parseInt(e.target.value) })}>
              <option value={1}>启用</option>
              <option value={0}>禁用</option>
            </select>
          </div>
        </div>

        <div className="card">
          <h2>PWA 安装</h2>
          <p className="hint">在支持的浏览器中，可将 LifeHub 安装到主屏幕（桌面/手机），离线可用静态资源。</p>
          <button type="button" className="btn secondary" onClick={handleInstall} style={{ display: deferredPrompt ? 'inline-flex' : 'none' }}>安装到主屏幕</button>
          <p className="hint" style={{ display: deferredPrompt ? 'none' : 'block' }}>当前浏览器不支持安装，或已安装。</p>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </form>
    </section>
  )
}