import { sql } from '@vercel/postgres';
import crypto from 'crypto';

const COOKIE_NAME = 'tls_admin_session';

function isAuthorized(req) {
  const secret = process.env.SESSION_SECRET;
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return false;

  const raw = decodeURIComponent(match.split('=').slice(1).join('='));
  const [value, hmac] = raw.split('.');
  if (!value || !hmac) return false;

  const expected = crypto.createHmac('sha256', secret).update(value).digest('hex');
  if (hmac.length !== expected.length) return false;
  const valid = crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));

  return valid && Date.now() <= Number(value);
}

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // GET all categories
  if (req.method === 'GET') {
    try {
      const { rows } = await sql`SELECT id, name, slug, sort_order, created_at FROM categories ORDER BY sort_order ASC, name ASC`;
      return res.status(200).json(rows);
    } catch (err) {
      console.error('GET /api/categories error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // POST create category
  if (req.method === 'POST') {
    const { name, slug, sort_order } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name required' });
    }
    if (!slug || !slug.trim()) {
      return res.status(400).json({ error: 'Slug required' });
    }
    try {
      const { rows } = await sql`
        INSERT INTO categories (name, slug, sort_order)
        VALUES (${name.trim()}, ${slug.trim()}, ${sort_order || 0})
        RETURNING id
      `;
      return res.status(200).json({ success: true, id: rows[0].id });
    } catch (err) {
      console.error('POST /api/categories error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // PUT update category
  if (req.method === 'PUT') {
    const { id, name, slug, sort_order } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
    if (!slug || !slug.trim()) return res.status(400).json({ error: 'Slug required' });

    try {
      const { rowCount } = await sql`
        UPDATE categories SET name = ${name.trim()}, slug = ${slug.trim()}, sort_order = ${sort_order || 0}
        WHERE id = ${id}
      `;
      if (rowCount === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('PUT /api/categories error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // DELETE category
  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });

    try {
      const { rows } = await sql`SELECT id FROM products WHERE category_id = ${id} LIMIT 1`;
      if (rows.length > 0) {
        return res.status(400).json({ error: 'Category is used by products' });
      }
      await sql`DELETE FROM categories WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('DELETE /api/categories error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
