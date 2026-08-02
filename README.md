# LifeHub

单用户个人行动操作系统：通过任务、日历、联系人和财务数据，主动提醒用户下一步行动。

技术栈：React + PWA (Vite) / **Vercel (前端 + API)** / **Cloudflare Worker (Cron)** / Cloudflare D1 / Telegram Bot。
Monorepo：npm workspaces，不使用 Turborepo。

## 目录

```
apps/web                    React PWA + Vercel Functions (API + Telegram webhook)
apps/reminder-worker        Cloudflare Worker，scheduled()，仅执行 Reminder Engine
packages/reminder-engine    提醒引擎，零依赖纯 JS，两端共用
database/schema.sql         D1 初始化 SQL（7 表 + 索引 + 种子）
```

## 架构

```
用户 → Vercel (React + /api/* + /telegram)
                    ↑↓ D1
Cloudflare Worker (Cron */15) → Reminder Engine → Telegram Bot
```

- Vercel Functions 不支持 Cron，定时任务放独立 Cloudflare Worker。
- Cron 运行在 UTC，所有本地时间计算统一走 settings.timezone，禁止硬编码时区。
- 时间型规则使用 next_fire_at 模型（首次为 NULL 时只初始化不发送）。
- Vercel 前端国内极快（香港/新加坡边缘），Worker 仅跑 Cron。

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 创建 D1 数据库
npm run db:create
# 将输出的 database_id 填入 apps/reminder-worker/wrangler.toml

# 3. 本地建表
npm run db:migrate:local

# 4. 本地开发
npm run dev:web       # Vite dev server (代理到 Vercel Functions)
npm run dev:worker    # Worker 本地测试 --test-scheduled

# 5. 部署
# Vercel: 导入 GitHub 仓库，Root Directory: apps/web
# Worker: cd apps/reminder-worker && npx wrangler deploy
```

## 部署清单

详见 [DEPLOYMENT.md](./DEPLOYMENT.md)

## Secrets

| 环境 | Secret | 用途 |
|------|--------|------|
| Vercel | `LIFEHUB_TOKEN` | API Bearer 鉴权（前端需配置 `VITE_LIFEHUB_TOKEN`） |
| Vercel | `TELEGRAM_BOT_TOKEN` | 校验 Telegram webhook |
| Vercel | `CRON_SECRET` | Cron 调度鉴权 |
| Worker | `TELEGRAM_BOT_TOKEN` | 发送提醒 |
| Worker | `CRON_SECRET` | 调用 Vercel Cron 端点 |

Worker 直接连 D1，不需要 `LIFEHUB_TOKEN`。

本地开发放 `.dev.vars`（Vercel）与 `apps/reminder-worker/.dev.vars`（Worker），均已被 gitignore。

## Telegram webhook

```bash
# 指向 Vercel 域名（生产）
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<your-vercel-domain>/api/telegram" \
  -d "secret_token=<TOKEN>"
```

- `/start`：绑定 chat_id 写入 settings。
- 内联按钮 `task_complete:<id>`：完成任务。

## 提醒规则

- `type: "time"`：按 `schedule`（cron 子集：每天/每周/每月）+ `next_fire_at` 触发。
- `type: "data"`：按 `source` + `condition_json` 求值（before / days_since / deadline_before / over_budget），配合 `notify_interval`（秒）去重。
- `notify_interval` 单位秒；`reminder_logs.status`：`sent | failed | skipped`。

## 本地开发

```bash
# 终端 1: 前端
npm run dev:web       # Vite dev server :5174 (代理到 Vercel Functions)

# 终端 2: Worker
npm run dev:worker    # Worker 本地测试 --test-scheduled
```

## 环境变量

本地开发创建 `.dev.vars`：

```bash
# apps/web/.dev.vars
LIFEHUB_TOKEN=dev-token-12345
TELEGRAM_BOT_TOKEN=your-bot-token

# apps/reminder-worker/.dev.vars
TELEGRAM_BOT_TOKEN=your-bot-token
CRON_SECRET=your-cron-secret
```

## 可用脚本

```bash
npm run dev:web       # Vite dev server
npm run dev:worker    # Worker 本地测试
npm run build         # 构建前端
npm run db:create     # 创建 D1 数据库
npm run db:migrate:local  # 本地迁移
npm run db:migrate    # 远程迁移
npm run deploy:web    # 部署 Vercel
npm run deploy:worker # 部署 Worker
```

## 核心指标

> 连续使用 7 天，不主动打开 App，也能收到 80% 以上应该收到的提醒。