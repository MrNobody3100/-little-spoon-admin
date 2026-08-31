import { sql } from '@vercel/postgres';
import crypto from 'crypto';
const aaa = ''
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

  // GET all products
  if (req.method === 'GET') {
    try {
      const { rows } = await sql`
        SELECT
          p.id, p.name, p.description, p.price, p.image_url,
          p.is_available, p.created_at,
          p.category_id, c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        ORDER BY p.created_at DESC
      `;
      return res.status(200).json(rows);
    } catch (err) {
      console.error('GET /api/products error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // POST create product
  if (req.method === 'POST') {
    const { name, description, price, imageUrl, categoryId } = req.body || {};
    if (!name || !imageUrl) {
      return res.status(400).json({ error: 'Name and image URL required' });
    }
    try {
      const { rows } = await sql`
        INSERT INTO products (name, description, price, image_url, category_id)
        VALUES (${name.trim()}, ${description || null}, ${price || null}, ${imageUrl}, ${categoryId || null})
        RETURNING id
      `;
      return res.status(200).json({ success: true, id: rows[0].id });
    } catch (err) {
      console.error('POST /api/products error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // PUT update product
  if (req.method === 'PUT') {
    const { id, name, description, price, imageUrl, categoryId, isAvailable } = req.body || {};
    if (!id) {
      return res.status(400).json({ error: 'id required' });
    }
    try {
      const { rows: existingRows } = await sql`SELECT * FROM products WHERE id = ${id}`;
      if (existingRows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      const existing = existingRows[0];

      const merged = {
        name: name !== undefined ? name.trim() : existing.name,
        description: description !== undefined ? description : existing.description,
        price: price !== undefined ? price : existing.price,
        image_url: imageUrl !== undefined ? imageUrl : existing.image_url,
        category_id: categoryId !== undefined ? categoryId : existing.category_id,
        is_available: isAvailable !== undefined ? isAvailable : existing.is_available
      };

      await sql`
        UPDATE products SET
          name = ${merged.name},
          description = ${merged.description},
          price = ${merged.price},
          image_url = ${merged.image_url},
          category_id = ${merged.category_id},
          is_available = ${merged.is_available}
        WHERE id = ${id}
      `;
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('PUT /api/products error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // DELETE product
  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) {
      return res.status(400).json({ error: 'id required' });
    }
    try {
      await sql`DELETE FROM products WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('DELETE /api/products error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
