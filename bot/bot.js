/**
 * ManhwaUZ Telegram Bot
 * Admin panel Telegram Mini App sifatida ochiladi
 *
 * Deploy: Railway.app
 * Muhit o'zgaruvchilari:
 *   BOT_TOKEN          — BotFather dan olingan token
 *   ADMIN_IDS          — Adminlar Telegram ID lari (vergul bilan): 12345678,87654321
 *   WORKERS_URL        — https://manhwauz-api.YOUR.workers.dev
 *   ADMIN_SECRET       — Workers API uchun maxfiy kalit
 *   MINI_APP_URL       — https://manhwauz.pages.dev/admin/
 *   PORT               — (Railway avtomatik belgilaydi, default 3000)
 *   BOT_WEBHOOK_URL    — https://manhwauz-bot.railway.app (Railway URL)
 */

const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const multer  = require('multer');
const FormData = require('form-data');
const fetch   = require('node-fetch');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');

// ── Config ────────────────────────────────────────────────────
const BOT_TOKEN     = process.env.BOT_TOKEN;
const ADMIN_IDS     = (process.env.ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const WORKERS_URL   = (process.env.WORKERS_URL || '').replace(/\/$/, '');
const ADMIN_SECRET  = process.env.ADMIN_SECRET || '';
const MINI_APP_URL  = process.env.MINI_APP_URL || '';
const PORT          = parseInt(process.env.PORT || '3000');
const WEBHOOK_URL   = (process.env.BOT_WEBHOOK_URL || '').replace(/\/$/, '');

if (!BOT_TOKEN) { console.error('❌ BOT_TOKEN yo\'q!'); process.exit(1); }

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const upload = multer({ dest: '/tmp/mu_uploads/', limits: { fileSize: 30 * 1024 * 1024 } });

app.use(express.json());

// ── Helpers ───────────────────────────────────────────────────
function isAdmin(ctx) {
  return ADMIN_IDS.includes(String(ctx.from?.id || ''));
}

function adminRequired(ctx, next) {
  if (!isAdmin(ctx)) return ctx.reply('⛔ Ruxsat yo\'q.');
  return next();
}

async function workersApi(endpoint, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${ADMIN_SECRET}`,
      'Content-Type':  'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${WORKERS_URL}${endpoint}`, opts);
  return r.json();
}

// Telegram WebApp initData ni tekshirish (xavfsizlik)
function verifyInitData(initData, botToken) {
  const params = new URLSearchParams(initData);
  const hash   = params.get('hash');
  params.delete('hash');
  const data   = [...params.entries()].sort().map(([k,v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const check  = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return check === hash;
}

// ── Bot Commands ──────────────────────────────────────────────

// /start — Admin panelni Mini App sifatida ochish
bot.start(adminRequired, async (ctx) => {
  let statsText = '';
  try {
    const stats = await workersApi('/api/stats');
    statsText = `\n📚 ${stats.comics} komiks  |  📖 ${stats.chapters} bob`;
  } catch(e) {}

  await ctx.reply(
    `🎛 *ManhwaUZ Admin Panel*${statsText}\n\nQuyidagi tugmani bosing:`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🖥 Admin Panelni Ochish', MINI_APP_URL)],
        [
          Markup.button.callback('📊 Statistika', 'stats'),
          Markup.button.callback('📚 Komiklar', 'list_comics'),
        ],
      ]),
    }
  );
});

// /stats
bot.command('stats', adminRequired, async (ctx) => {
  try {
    const stats = await workersApi('/api/stats');
    await ctx.reply(
      `📊 *Statistika*\n\n` +
      `🗂 Komiklar: *${stats.comics}*\n` +
      `📖 Jami boblar: *${stats.chapters}*\n` +
      `🏷 Janrlar: *${stats.genres}*\n` +
      `✅ API ishlayapti`,
      { parse_mode: 'Markdown' }
    );
  } catch(e) {
    await ctx.reply('❌ Statistika olishda xato: ' + e.message);
  }
});

// /list — Komiklar ro'yxati
bot.command('list', adminRequired, async (ctx) => {
  try {
    const comics = await workersApi('/api/comics.json');
    const top10  = comics.slice(0, 10);
    const text   = top10.map((c, i) =>
      `${i+1}. *${c.title}* (${c.chapters?.length || 0} bob)`
    ).join('\n');
    await ctx.reply(
      `📚 *So'nggi ${top10.length} komiks:*\n\n${text}\n\n_Barchasi: ${comics.length} ta_`,
      { parse_mode: 'Markdown' }
    );
  } catch(e) {
    await ctx.reply('❌ Xato: ' + e.message);
  }
});

// /help
bot.command('help', adminRequired, (ctx) => {
  ctx.reply(
    `🤖 *ManhwaUZ Bot Buyruqlari*\n\n` +
    `/start — Admin panelni ochish\n` +
    `/stats — Statistika\n` +
    `/list  — Komiklar ro'yxati\n` +
    `/help  — Yordam\n\n` +
    `💡 Admin panelda barcha operatsiyalar mavjud.`,
    { parse_mode: 'Markdown' }
  );
});

// Callback: Statistika
bot.action('stats', adminRequired, async (ctx) => {
  await ctx.answerCbQuery();
  try {
    const stats = await workersApi('/api/stats');
    await ctx.reply(
      `📊 *Statistika*\n\n🗂 ${stats.comics} komiks\n📖 ${stats.chapters} bob\n🏷 ${stats.genres} janr`,
      { parse_mode: 'Markdown' }
    );
  } catch(e) {
    await ctx.reply('❌ Xato: ' + e.message);
  }
});

// Callback: Komiklar ro'yxati
bot.action('list_comics', adminRequired, async (ctx) => {
  await ctx.answerCbQuery();
  try {
    const comics = await workersApi('/api/comics.json');
    const text   = comics.slice(0,8).map((c,i) => `${i+1}. ${c.title}`).join('\n');
    await ctx.reply(`📚 *Komiklar:*\n${text}\n_Jami: ${comics.length}_ ta`, { parse_mode: 'Markdown' });
  } catch(e) {
    await ctx.reply('❌ Xato');
  }
});

// ── Express routes ────────────────────────────────────────────

// Webhook endpoint
app.post('/webhook', (req, res) => {
  bot.handleUpdate(req.body, res);
});

// Sog'liq tekshiruvi (Railway uchun)
app.get('/health', (_, res) => res.json({ ok: true, ts: Date.now() }));

// ── Mini App API endpoints ────────────────────────────────────
// Mini App shu bot serverga API so'rov yuboradi
// Bot server initData ni tekshirib, Workers API ga proxylaydi

// Middleware: Mini App autentifikatsiyasi
function miniAppAuth(req, res, next) {
  const initData = req.headers['x-telegram-init-data'];
  if (!initData) return res.status(401).json({ error: 'initData yo\'q' });

  // Development da tekshirishni o'tkazib yuborish mumkin
  if (process.env.NODE_ENV === 'development') return next();

  if (!verifyInitData(initData, BOT_TOKEN)) {
    return res.status(401).json({ error: 'initData noto\'g\'ri' });
  }

  // Foydalanuvchi admin ekanligini tekshirish
  const params = new URLSearchParams(initData);
  const user   = JSON.parse(params.get('user') || '{}');
  if (!ADMIN_IDS.includes(String(user.id))) {
    return res.status(403).json({ error: 'Admin emas' });
  }
  next();
}

// Barcha /api/admin/* so'rovlarni Workers ga proxy qilish
app.all('/mini-api/*', miniAppAuth, async (req, res) => {
  try {
    const endpoint = req.path.replace('/mini-api', '');
    const method   = req.method;
    let   body     = null;

    if (['POST', 'PUT', 'PATCH'].includes(method) && req.body) {
      body = req.body;
    }

    const result = await workersApi(endpoint, method, body);
    res.json(result);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Cover rasmini yuklash: Mini App → Bot server → R2
app.post('/mini-api-upload/cover', miniAppAuth, upload.single('cover'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fayl topilmadi' });

  const slug = req.body.slug;
  if (!slug) return res.status(400).json({ error: 'Slug kiritilmagan' });

  try {
    // Faylni o'qish
    const fileData   = fs.readFileSync(req.file.path);
    const ext        = path.extname(req.file.originalname).toLowerCase() || '.webp';
    const r2Key      = `public/images/covers/${slug}${ext}`;
    const coverUrl   = `/public/images/covers/${slug}${ext}`;

    // R2 ga yuklash (Workers orqali)
    const uploadResp = await fetch(`${WORKERS_URL}/api/admin/r2-upload`, {
      method:  'PUT',
      headers: {
        'Authorization':  `Bearer ${ADMIN_SECRET}`,
        'Content-Type':   req.file.mimetype || 'image/webp',
        'X-R2-Key':       r2Key,
      },
      body: fileData,
    });
    const uploadResult = await uploadResp.json();

    // Vaqtinchalik faylni o'chirish
    fs.unlinkSync(req.file.path);

    if (!uploadResult.ok) return res.status(500).json({ error: 'R2 ga yuklash xato' });

    // Comics.json da cover URLni yangilash
    await workersApi(`/api/admin/cover/${slug}`, 'PUT', { cover: coverUrl });

    res.json({ ok: true, cover: coverUrl });
  } catch(e) {
    try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: e.message });
  }
});

// Bob rasmlari yuklash: Mini App → Bot server → R2
app.post('/mini-api-upload/chapter', miniAppAuth, upload.array('images', 350), async (req, res) => {
  const { slug, chapter } = req.body;
  if (!slug || !chapter) return res.status(400).json({ error: 'slug va chapter kerak' });
  if (!req.files?.length) return res.status(400).json({ error: 'Rasmlar topilmadi' });

  const chNum = parseInt(chapter);
  const uploadedPaths = [];
  const errors = [];

  for (let i = 0; i < req.files.length; i++) {
    const file    = req.files[i];
    const padded  = String(i + 1).padStart(3, '0');
    const ext     = path.extname(file.originalname).toLowerCase() || '.webp';
    const r2Key   = `uploads/${slug}/chapter-${chNum}/${padded}${ext}`;

    try {
      const fileData = fs.readFileSync(file.path);
      const resp     = await fetch(`${WORKERS_URL}/api/admin/r2-upload`, {
        method:  'PUT',
        headers: {
          'Authorization': `Bearer ${ADMIN_SECRET}`,
          'Content-Type':  file.mimetype || 'image/webp',
          'X-R2-Key':      r2Key,
        },
        body: fileData,
      });
      const result = await resp.json();
      if (result.ok) uploadedPaths.push('/' + r2Key);
      else errors.push(file.originalname);
    } catch(e) {
      errors.push(file.originalname);
    } finally {
      try { fs.unlinkSync(file.path); } catch {}
    }
  }

  // Bob ma'lumotlarini yangilash
  if (uploadedPaths.length > 0) {
    await workersApi(`/api/admin/chapters/${slug}`, 'POST', {
      number: chNum,
      title:  req.body.title || '',
      date:   new Date().toISOString().slice(0, 10),
      images: uploadedPaths,
    });
  }

  res.json({
    ok:       uploadedPaths.length > 0,
    uploaded: uploadedPaths.length,
    errors,
    images:   uploadedPaths,
  });
});

// ── Workers R2 upload proxy endpoint ─────────────────────────
// Workers api.js ga qo'shish kerak bo'lgan endpoint
// Bot server R2 ga to'g'ridan-to'g'ri yozolmaydi, Workers orqali qiladi

// ── Server ishga tushirish ────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`✅ ManhwaUZ Bot Server — port ${PORT}`);
  console.log(`📡 Workers URL: ${WORKERS_URL}`);
  console.log(`👤 Admin IDs: ${ADMIN_IDS.join(', ')}`);

  if (WEBHOOK_URL) {
    try {
      await bot.telegram.setWebhook(`${WEBHOOK_URL}/webhook`);
      console.log(`🔗 Webhook: ${WEBHOOK_URL}/webhook`);
    } catch(e) {
      console.error('Webhook xato:', e.message);
    }
  } else {
    // Local dev: polling
    console.log('🔄 Polling rejimida ishlamoqda (local dev)');
    bot.launch();
  }
});

// Graceful shutdown
process.once('SIGINT',  () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
