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
    return res.status(401).json({ error: 'Non autorisé' });
  }

  // GET all categories
  if (req.method === 'GET') {
    try {
      const { rows } = await sql`SELECT * FROM categories ORDER BY name ASC`;
      return res.status(200).json(rows);
    } catch (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  // POST create a new category
  if (req.method === 'POST') {
    const { name } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nom requis' });
    }
    try {
      const { rows } = await sql`
        INSERT INTO categories (name) VALUES (${name.trim()}) RETURNING id
      `;
      return res.status(200).json({ success: true, id: rows[0].id });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  // PUT update a category
  if (req.method === 'PUT') {
    const { id, name } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id requis' });
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nom requis' });

    try {
      const { rowCount } = await sql`
        UPDATE categories SET name = ${name.trim()} WHERE id = ${id}
      `;
      if (rowCount === 0) {
        return res.status(404).json({ error: 'Catégorie introuvable' });
      }
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  // DELETE a category
  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id requis' });

    try {
      // Check if any products use this category
      const { rows } = await sql`SELECT id FROM products WHERE category_id = ${id} LIMIT 1`;
      if (rows.length > 0) {
        return res.status(400).json({ error: 'Cette catégorie est utilisée par des produits' });
      }
      await sql`DELETE FROM categories WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}
