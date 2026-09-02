import { query } from '../db.js';
import crypto from 'crypto';

const COOKIE_NAME = 'tls_admin_session';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  console.log('📡 /api/categories called');

  try {
    // ---- STEP 1: Check SESSION_SECRET ----
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      console.error('❌ SESSION_SECRET missing');
      return res.status(500).json({ error: 'SESSION_SECRET missing', step: 1 });
    }

    // ---- STEP 2: Check database connection ----
    try {
      const test = await query('SELECT NOW() as now');
      console.log('✅ Database connected:', test.rows[0].now);
    } catch (dbErr) {
      console.error('❌ Database error:', dbErr.message);
      return res.status(500).json({
        error: 'Database connection failed',
        details: dbErr.message,
        step: 2
      });
    }

    // ---- STEP 3: Check if categories table exists ----
    try {
      const tableCheck = await query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'categories'
        ) as exists
      `);

      if (!tableCheck.rows[0].exists) {
        console.error('❌ Categories table missing');
        return res.status(500).json({ error: 'Categories table does not exist', step: 3 });
      }
    } catch (tableErr) {
      console.error('❌ Table check error:', tableErr.message);
      return res.status(500).json({
        error: 'Error checking table',
        details: tableErr.message,
        step: 3
      });
    }

    // ---- STEP 4: Check auth cookie ----
    const cookieHeader = req.headers.cookie || '';
    const match = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${COOKIE_NAME}=`));

    if (!match) {
      console.log('⚠️ No auth cookie found');
      return res.status(401).json({ error: 'Non autorisé - No cookie', step: 4 });
    }

    // ---- STEP 5: Verify cookie signature ----
    try {
      const raw = decodeURIComponent(match.split('=').slice(1).join('='));
      const [value, hmac] = raw.split('.');
      if (!value || !hmac) {
        return res.status(401).json({ error: 'Invalid cookie format', step: 5 });
      }

      const expected = crypto.createHmac('sha256', secret).update(value).digest('hex');
      if (hmac.length !== expected.length) {
        return res.status(401).json({ error: 'HMAC length mismatch', step: 5 });
      }

      const valid = crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
      if (!valid) {
        return res.status(401).json({ error: 'Invalid signature', step: 5 });
      }

      if (Date.now() > Number(value)) {
        return res.status(401).json({ error: 'Session expired', step: 5 });
      }
    } catch (authErr) {
      console.error('❌ Auth error:', authErr.message);
      return res.status(401).json({ error: 'Auth error', details: authErr.message, step: 5 });
    }

    // ---- STEP 6: Handle the request ----
    if (req.method === 'GET') {
      try {
        const { rows } = await query(
          'SELECT id, name, slug, sort_order, created_at FROM categories ORDER BY sort_order ASC, name ASC'
        );
        console.log(`✅ Returning ${rows.length} categories`);
        return res.status(200).json(rows);
      } catch (err) {
        console.error('❌ GET error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch categories', details: err.message, step: 6 });
      }
    }

    if (req.method === 'POST') {
      const { name, slug, sort_order } = req.body || {};

      if (!name || !name.trim()) return res.status(400).json({ error: 'Nom requis' });
      if (!slug || !slug.trim()) return res.status(400).json({ error: 'Slug requis' });

      try {
        const { rows } = await query(
          'INSERT INTO categories (name, slug, sort_order) VALUES ($1, $2, $3) RETURNING id',
          [name.trim(), slug.trim(), sort_order || 0]
        );
        console.log(`✅ Category created: ${rows[0].id}`);
        return res.status(200).json({ success: true, id: rows[0].id });
      } catch (err) {
        console.error('❌ POST error:', err.message);
        return res.status(500).json({ error: 'Failed to create category', details: err.message, step: 6 });
      }
    }

    if (req.method === 'PUT') {
      const { id, name, slug, sort_order } = req.body || {};

      if (!id) return res.status(400).json({ error: 'id requis' });
      if (!name || !name.trim()) return res.status(400).json({ error: 'Nom requis' });
      if (!slug || !slug.trim()) return res.status(400).json({ error: 'Slug requis' });

      try {
        const { rowCount } = await query(
          'UPDATE categories SET name = $1, slug = $2, sort_order = $3 WHERE id = $4',
          [name.trim(), slug.trim(), sort_order || 0, id]
        );
        if (rowCount === 0) return res.status(404).json({ error: 'Catégorie introuvable' });
        console.log(`✅ Category updated: ${id}`);
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error('❌ PUT error:', err.message);
        return res.status(500).json({ error: 'Failed to update category', details: err.message, step: 6 });
      }
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id requis' });

      try {
        const { rows } = await query('SELECT id FROM products WHERE category_id = $1 LIMIT 1', [id]);
        if (rows.length > 0) {
          return res.status(400).json({ error: 'Cette catégorie est utilisée par des produits' });
        }

        await query('DELETE FROM categories WHERE id = $1', [id]);
        console.log(`✅ Category deleted: ${id}`);
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error('❌ DELETE error:', err.message);
        return res.status(500).json({ error: 'Failed to delete category', details: err.message, step: 6 });
      }
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    console.error('❌ UNHANDLED ERROR:', err.message);
    return res.status(500).json({ error: 'Unhandled server error', details: err.message });
  }
}
