/**
 * ManhwaUZ Cloudflare Workers API
 * PHP router.php + comments.php + ranking.php o'rnini bosadi
 *
 * Bindings (wrangler.toml da sozlang):
 *   COMICS_KV  — KV Namespace (comics.json, comments, chapter images)
 *   R2_BUCKET  — R2 Bucket (rasmlar)
 *   ADMIN_SECRET — Maxfiy kalit (bot server uchun)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Telegram-Init-Data',
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
  });
}

function err(msg, status = 400) {
  return json({ ok: false, error: msg }, status);
}

// ── Auth: Bot server so'rovi ekanligini tekshirish ────────────
function isAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  return auth === `Bearer ${env.ADMIN_SECRET}`;
}

// ── Comics: KV dan yuklash ────────────────────────────────────
async function getComics(env) {
  const raw = await env.COMICS_KV.get('comics.json');
  if (!raw) return [];
  return JSON.parse(raw);
}

async function saveComics(env, comics) {
  await env.COMICS_KV.put('comics.json', JSON.stringify(comics, null, 2));
}

// ── Main fetch handler ────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') return new Response(null, { headers: CORS });

    // ══════════════════════════════════════════════════
    // GET /api/comics.json — Barcha komiklar
    // ══════════════════════════════════════════════════
    if (path === '/api/comics.json' && method === 'GET') {
      const comics = await getComics(env);
      return json(comics, 200, { 'Cache-Control': 'public, max-age=30' });
    }

    // ══════════════════════════════════════════════════
    // GET /api/comics/:slug — Bitta komiks
    // ══════════════════════════════════════════════════
    const comicMatch = path.match(/^\/api\/comics\/([a-z0-9-]+)$/);
    if (comicMatch && method === 'GET') {
      const slug   = comicMatch[1];
      const comics = await getComics(env);
      const comic  = comics.find(c => c.slug === slug);
      if (!comic) return err('Komiks topilmadi', 404);
      return json(comic, 200, { 'Cache-Control': 'public, max-age=30' });
    }

    // ══════════════════════════════════════════════════
    // GET /api/ranking?by=rating|views|chapters|updated
    // ══════════════════════════════════════════════════
    if (path === '/api/ranking' && method === 'GET') {
      const by     = url.searchParams.get('by') || 'rating';
      const comics = await getComics(env);

      const sorted = [...comics].sort((a, b) => {
        if (by === 'rating')   return (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0);
        if (by === 'views')    return (parseInt(b.viewCount) || 0) - (parseInt(a.viewCount) || 0);
        if (by === 'chapters') return (b.chapters?.length || 0) - (a.chapters?.length || 0);
        if (by === 'updated')  return (b.lastUpdated || '').localeCompare(a.lastUpdated || '');
        return 0;
      });

      return json(sorted.map(c => ({
        slug:        c.slug,
        title:       c.title,
        cover:       c.cover,
        author:      c.author,
        status:      c.status,
        rating:      c.rating,
        viewCount:   c.viewCount,
        chapterCount: c.chapters?.length || 0,
        lastUpdated: c.lastUpdated,
      })), 200, { 'Cache-Control': 'public, max-age=60' });
    }

    // ══════════════════════════════════════════════════
    // GET /api/chapter-images/:slug/:chapter
    // R2 dan chapter rasmlarini ro'yxatini qaytarish
    // ══════════════════════════════════════════════════
    const imgMatch = path.match(/^\/api\/chapter-images\/([a-z0-9-]+)\/(\d+)$/);
    if (imgMatch && method === 'GET') {
      const [, slug, chapter] = imgMatch;
      const prefix  = `uploads/${slug}/chapter-${chapter}/`;

      // KV da saqlangan rasmlar ro'yxatini olamiz
      const listKey = `chapter-list:${slug}:${chapter}`;
      const cached  = await env.COMICS_KV.get(listKey);
      if (cached) return json(JSON.parse(cached), 200, { 'Cache-Control': 'public, max-age=300' });

      // R2 dan ro'yxat olamiz
      const listed = await env.R2_BUCKET.list({ prefix });
      const images  = listed.objects
        .map(o => '/' + o.key)
        .filter(k => /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(k))
        .sort();

      if (images.length) await env.COMICS_KV.put(listKey, JSON.stringify(images), { expirationTtl: 300 });
      return json(images, 200, { 'Cache-Control': 'public, max-age=300' });
    }

    // ══════════════════════════════════════════════════
    // GET /api/comments/:slug
    // ══════════════════════════════════════════════════
    const cmMatch = path.match(/^\/api\/comments\/([a-z0-9-]+)$/);
    if (cmMatch && method === 'GET') {
      const slug = cmMatch[1];
      const raw  = await env.COMICS_KV.get(`comments:${slug}`) || '[]';
      const comments = JSON.parse(raw);
      comments.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return json(comments, 200, { 'Cache-Control': 'no-store' });
    }

    // ══════════════════════════════════════════════════
    // POST /api/comments/:slug  { text, author }
    // ══════════════════════════════════════════════════
    if (cmMatch && method === 'POST') {
      const slug = cmMatch[1];
      let body;
      try { body = await request.json(); } catch { return err('JSON noto\'g\'ri'); }

      const text   = String(body.text || '').trim().slice(0, 1000);
      const author = String(body.author || 'Anonymous').trim().slice(0, 50);
      if (!text) return err('Izoh matni kiritilmagan');

      const existing = JSON.parse(await env.COMICS_KV.get(`comments:${slug}`) || '[]');
      existing.unshift({
        id:        crypto.randomUUID().slice(0, 16),
        text,
        author,
        createdAt: new Date().toISOString(),
      });

      await env.COMICS_KV.put(`comments:${slug}`, JSON.stringify(existing.slice(0, 300)));
      return json({ ok: true });
    }

    // ══════════════════════════════════════════════════
    // GET /api/stats — Dashboard uchun umumiy statistika
    // ══════════════════════════════════════════════════
    if (path === '/api/stats' && method === 'GET') {
      if (!isAdmin(request, env)) return err('Ruxsat yo\'q', 401);
      const comics = await getComics(env);
      return json({
        comics:   comics.length,
        chapters: comics.reduce((s, c) => s + (c.chapters?.length || 0), 0),
        genres:   [...new Set(comics.flatMap(c => c.genres || []))].length,
      });
    }

    // ══════════════════════════════════════════════════
    // POST /api/admin/comics — Yangi komiks qo'shish
    // Bot Mini App dan keladi
    // ══════════════════════════════════════════════════
    if (path === '/api/admin/comics' && method === 'POST') {
      if (!isAdmin(request, env)) return err('Ruxsat yo\'q', 401);
      let body;
      try { body = await request.json(); } catch { return err('JSON noto\'g\'ri'); }

      const { title, slug, author, illustrator, status, type,
              description, rating, viewCount, year, genres, cover } = body;

      if (!title) return err('Sarlavha kiritilishi shart');

      const comics = await getComics(env);
      if (comics.find(c => c.slug === slug)) return err('Bu slug allaqachon mavjud: ' + slug);

      const newComic = {
        slug:         slug || title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),
        title,
        author:       author || '',
        illustrator:  illustrator || '',
        status:       status || 'Ongoing',
        type:         type || 'Manhwa',
        description:  description || '',
        rating:       parseFloat(rating) || 0,
        ratingCount:  0,
        viewCount:    parseInt(viewCount) || 0,
        episodeCount: 0,
        year:         parseInt(year) || new Date().getFullYear(),
        genres:       genres || [],
        cover:        cover || '',
        chapters:     [],
        latestTs:     0,
        lastUpdated:  '',
        createdAt:    new Date().toISOString().slice(0,10),
        updatedAt:    new Date().toISOString().slice(0,10),
      };

      comics.unshift(newComic);
      await saveComics(env, comics);
      return json({ ok: true, slug: newComic.slug });
    }

    // ══════════════════════════════════════════════════
    // PUT /api/admin/comics/:slug — Komiks tahrirlash
    // ══════════════════════════════════════════════════
    const adminComicMatch = path.match(/^\/api\/admin\/comics\/([a-z0-9-]+)$/);
    if (adminComicMatch && method === 'PUT') {
      if (!isAdmin(request, env)) return err('Ruxsat yo\'q', 401);
      const slug = adminComicMatch[1];
      let body;
      try { body = await request.json(); } catch { return err('JSON noto\'g\'ri'); }

      const comics = await getComics(env);
      const idx    = comics.findIndex(c => c.slug === slug);
      if (idx === -1) return err('Komiks topilmadi', 404);

      comics[idx] = {
        ...comics[idx],
        ...body,
        slug,            // slugni o'zgartirmaydi
        updatedAt: new Date().toISOString().slice(0,10),
      };

      await saveComics(env, comics);
      return json({ ok: true });
    }

    // ══════════════════════════════════════════════════
    // DELETE /api/admin/comics/:slug — Komiks o'chirish
    // ══════════════════════════════════════════════════
    if (adminComicMatch && method === 'DELETE') {
      if (!isAdmin(request, env)) return err('Ruxsat yo\'q', 401);
      const slug   = adminComicMatch[1];
      const comics = await getComics(env);
      const filtered = comics.filter(c => c.slug !== slug);
      if (filtered.length === comics.length) return err('Komiks topilmadi', 404);
      await saveComics(env, filtered);
      return json({ ok: true });
    }

    // ══════════════════════════════════════════════════
    // POST /api/admin/chapters/:slug — Bob qo'shish
    // ══════════════════════════════════════════════════
    const chAdminMatch = path.match(/^\/api\/admin\/chapters\/([a-z0-9-]+)$/);
    if (chAdminMatch && method === 'POST') {
      if (!isAdmin(request, env)) return err('Ruxsat yo\'q', 401);
      const slug = chAdminMatch[1];
      let body;
      try { body = await request.json(); } catch { return err('JSON noto\'g\'ri'); }

      const comics = await getComics(env);
      const idx    = comics.findIndex(c => c.slug === slug);
      if (idx === -1) return err('Komiks topilmadi', 404);

      const chapter = {
        number: parseInt(body.number),
        title:  body.title || '',
        date:   body.date || new Date().toISOString().slice(0,10),
        images: body.images || [],  // R2 path lar ro'yxati
      };

      // Mavjud bobni almashtirish yoki yangi qo'shish
      const existing = comics[idx].chapters || [];
      const chIdx    = existing.findIndex(c => c.number === chapter.number);
      if (chIdx >= 0) existing[chIdx] = chapter;
      else existing.push(chapter);

      // Sort: desc
      existing.sort((a,b) => b.number - a.number);
      comics[idx].chapters     = existing;
      comics[idx].episodeCount = existing.length;
      comics[idx].latestTs     = Date.now();
      comics[idx].lastUpdated  = chapter.date;
      comics[idx].updatedAt    = new Date().toISOString().slice(0,10);

      // Chapter image list cache ni tozalash
      await env.COMICS_KV.delete(`chapter-list:${slug}:${chapter.number}`);

      await saveComics(env, comics);
      return json({ ok: true, chapter: chapter.number });
    }

    // ══════════════════════════════════════════════════
    // DELETE /api/admin/chapters/:slug/:number
    // ══════════════════════════════════════════════════
    const delChMatch = path.match(/^\/api\/admin\/chapters\/([a-z0-9-]+)\/(\d+)$/);
    if (delChMatch && method === 'DELETE') {
      if (!isAdmin(request, env)) return err('Ruxsat yo\'q', 401);
      const [, slug, num] = delChMatch;
      const chNum = parseInt(num);

      const comics = await getComics(env);
      const idx    = comics.findIndex(c => c.slug === slug);
      if (idx === -1) return err('Komiks topilmadi', 404);

      comics[idx].chapters = (comics[idx].chapters || []).filter(c => c.number !== chNum);
      comics[idx].episodeCount = comics[idx].chapters.length;
      await env.COMICS_KV.delete(`chapter-list:${slug}:${chNum}`);
      await saveComics(env, comics);
      return json({ ok: true });
    }

    // ══════════════════════════════════════════════════
    // PUT /api/admin/cover/:slug
    // Cover URL ni yangilash (R2 ga yuklangandan keyin)
    // ══════════════════════════════════════════════════
    const coverMatch = path.match(/^\/api\/admin\/cover\/([a-z0-9-]+)$/);
    if (coverMatch && method === 'PUT') {
      if (!isAdmin(request, env)) return err('Ruxsat yo\'q', 401);
      const slug = coverMatch[1];
      let body;
      try { body = await request.json(); } catch { return err('JSON noto\'g\'ri'); }

      const comics = await getComics(env);
      const idx    = comics.findIndex(c => c.slug === slug);
      if (idx === -1) return err('Komiks topilmadi', 404);

      comics[idx].cover = body.cover || '';
      await saveComics(env, comics);
      return json({ ok: true });
    }


    // ══════════════════════════════════════════════════
    // PUT /api/admin/r2-upload — Bot server → R2
    // Header: X-R2-Key: uploads/slug/chapter-1/001.webp
    // Body: binary image data
    // ══════════════════════════════════════════════════
    if (path === '/api/admin/r2-upload' && method === 'PUT') {
      if (!isAdmin(request, env)) return err('Ruxsat yo\'q', 401);
      const r2Key = request.headers.get('X-R2-Key');
      if (!r2Key) return err('X-R2-Key header yo\'q');
      const contentType = request.headers.get('Content-Type') || 'image/webp';
      const body = await request.arrayBuffer();
      await env.R2_BUCKET.put(r2Key, body, { httpMetadata: { contentType } });
      return json({ ok: true, key: r2Key });
    }

    return err('Endpoint topilmadi', 404);
  },
};

// ══════════════════════════════════════════════════
// PUT /api/admin/r2-upload
// Bot server → Workers → R2 (rasm saqlash)