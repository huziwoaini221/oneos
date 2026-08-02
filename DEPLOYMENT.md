# LifeHub 部署清单 (Vercel + Cloudflare Worker)

## 架构
- **前端 + API**: Vercel (`apps/web`)
- **定时任务**: Cloudflare Worker (`apps/reminder-worker`)
- **数据库**: Cloudflare D1 (共享)
- **Telegram Webhook**: Vercel `/api/telegram`

## 目录结构
```
lifehub/
├── apps/
│   ├── web/                    # Vercel 部署
│   │   ├── api/                # Vercel API 路由
│   │   │   ├── cron/reminder.js
│   │   │   ├── telegram.js
│   │   │   └── tasks/...
│   │   ├── middleware.js       # Vercel 中间件
│   │   ├── vercel.json         # Vercel 配置
│   │   ├── src/                # React 源码
│   │   └── package.json
│   └── reminder-worker/        # Cloudflare Worker
│       ├── src/index.js
│       ├── wrangler.toml
│       └── package.json
├── packages/reminder-engine/   # 共享引擎
├── database/schema.sql
├── package.json                # 根 workspace
└── vercel.json                 # Vercel 配置
```

## 部署步骤

### 1. 推送代码
```bash
git add .
git commit -m "Deploy to Vercel + CF Worker"
git push origin main
```

### 2. 部署 Vercel 前端
1. Vercel Dashboard → Import Git Repository
2. Root Directory: `apps/web`
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. 环境变量:
   - `LIFEHUB_TOKEN` = `dev-token-12345`
   - `TELEGRAM_BOT_TOKEN` = 你的 Bot Token
   - `CRON_SECRET` = 随机强密钥

### 3. 部署 Cloudflare Worker
```bash
cd apps/reminder-worker
npx wrangler deploy
```
- 在 Cloudflare Dashboard → Worker → Settings → Variables and Secrets 添加:
  - `TELEGRAM_BOT_TOKEN`
  - `CRON_SECRET` (与 Vercel 相同)

### 4. 配置 D1 数据库
```bash
# 本地已迁移，远程执行:
npx wrangler d1 execute lifehub-db --file=../../database/schema.sql --remote
```

### 4. 绑定 D1 到 Worker
```bash
npx wrangler d1 binding add reminder-worker DB lifehub-db --remote
```

### 5. 设置 Telegram Webhook
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://<vercel-domain>/api/telegram" \
  -d "secret_token=<BOT_TOKEN>"
```

### 6. 更新 Worker 调用 Vercel
编辑 `apps/reminder-worker/src/index.js`:
```javascript
await fetch("https://<your-vercel-domain>/api/cron/reminder", {
  method: "POST",
  headers: { "Authorization": `Bearer ${env.CRON_SECRET}` }
})
```

## 环境变量清单

| 变量 | Vercel | Worker | 说明 |
|------|--------|--------|------|
| LIFEHUB_TOKEN | ✅ | ❌ | API 鉴权 |
| TELEGRAM_BOT_TOKEN | ✅ | ✅ | Bot 通信 |
| CRON_SECRET | ✅ | ✅ | Cron 调度鉴权 |
| CF_DATABASE_ID | ❌ | ✅ | D1 绑定 |

## 验收测试

```bash
# 前端
curl https://<vercel-domain>

# API
curl -H "Authorization: Bearer <TOKEN>" https://<vercel-domain>/api/tasks

# Telegram 绑定
发送 /start 给 Bot

# 定时触发
curl -X POST https://<vercel-domain>/api/cron/reminder \
  -H "Authorization: Bearer <CRON_SECRET>"
```

## 本地开发

```bash
# 终端 1: 前端
npm run dev:web

# 终端 2: Worker (本地测试)
cd apps/reminder-worker && npx wrangler dev --test-scheduled
```

## 注意事项

1. **Vercel Functions 限制**: 免费版 10 秒执行时间，`vercel.json` 已设置 `maxDuration: 30` (Pro 才生效)
2. **Cron 触发**: Worker 每 15 分钟调用 Vercel `/api/cron/reminder`
3. **共享引擎**: `packages/reminder-engine` 通过 npm workspace 共享
4. **D1 共享**: Worker 和 Vercel 使用同一个 D1 数据库