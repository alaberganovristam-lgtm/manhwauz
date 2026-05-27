# ManhwaUZ — Cloudflare + Telegram Bot

## Tezkor boshlash

### 1. Muhit o'zgaruvchilari

**GitHub Secrets** (Settings → Secrets → Actions):
| Secret | Qiymat |
|---|---|
| `CF_API_TOKEN` | [Cloudflare API Token](https://dash.cloudflare.com/profile/api-tokens) |
| `CF_ACCOUNT_ID` | Cloudflare Dashboard → Overview → Account ID |
| `KV_NAMESPACE_ID` | `wrangler kv:namespace create COMICS_KV` natijasi |
| `BOT_TOKEN` | [@BotFather](https://t.me/BotFather) dan token |
| `ADMIN_TELEGRAM_ID` | [@userinfobot](https://t.me/userinfobot) dan ID |
| `RAILWAY_WEBHOOK_URL` | Railway deploy webhook URL |

### 2. Birinchi marta sozlash

```bash
# 1. Wrangler o'rnatish
npm install -g wrangler
wrangler login

# 2. KV namespace yaratish
wrangler kv:namespace create COMICS_KV
# → ID ni wrangler.toml ga yozing

# 3. R2 bucket yaratish
wrangler r2 bucket create manhwauz-data
# → Bucket nomini wrangler.toml ga tekshiring

# 4. Workers secret qo'shish
cd workers
wrangler secret put ADMIN_SECRET
# → Kuchli parol kiriting (bot server bilan bir xil bo'lsin)

# 5. comics.json ni KV ga yuklash
wrangler kv:key put --namespace-id=YOUR_ID "comics.json" --path=../data/comics.json

# 6. Rasmlarni R2 ga yuklash
wrangler r2 object put manhwauz-data/public --file=../DATA/public/
```

### 3. Admin Mini App URL ni o'zgartirish

`admin/index.html` faylida:
```javascript
const BOT_API = 'https://manhwauz-bot.railway.app'; // Railway URL
const CDN     = 'https://pub-XXXX.r2.dev';          // R2 public URL
```

`_redirects` faylida:
```
/api/*     https://manhwauz-api.YOUR_SUBDOMAIN.workers.dev/api/:splat  200
/public/*  https://pub-XXXX.r2.dev/public/:splat                       200
/uploads/* https://pub-XXXX.r2.dev/uploads/:splat                      200
```

`_fix.js` faylida:
```javascript
window.MU_API = 'https://manhwauz-api.YOUR_SUBDOMAIN.workers.dev';
window.MU_CDN = 'https://pub-XXXX.r2.dev';
```

### 4. Deploy

```bash
git add .
git commit -m "Initial deploy"
git push origin main
# → GitHub Actions avtomatik deploy qiladi
```

## Arxitektura

```
GitHub push
  ├─► Cloudflare Pages  (web/) — manhwauz.com
  ├─► Cloudflare Workers (workers/) — /api/*
  ├─► KV → comics.json sync
  └─► Railway redeploy (bot/)

Telegram @ManhwaUZAdminBot
  └─► /start → Mini App (admin/index.html)
        └─► Bot server (Railway) → Workers API → KV + R2
```

## Papka strukturasi

```
manhwauz/
├── web/          # Cloudflare Pages (asosiy sayt)
├── workers/      # Cloudflare Workers (API)
├── data/         # comics.json
├── bot/          # Telegram Bot server (Railway)
├── admin/        # Mini App (Telegram da ochiladi)
└── .github/      # GitHub Actions
```
