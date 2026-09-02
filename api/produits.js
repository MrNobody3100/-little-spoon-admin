import { query } from '../db.js';
import crypto from 'crypto';

const COOKIE_NAME = 'tls_admin_session';

function isAuthorized(req) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.error('SESSION_SECRET manquant');
    return false;
  }

  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return false;

  const raw = decodeURIComponent(match.split('=').slice(1).join('='));
  const [value, hmac] = raw.split('.');
  if (!value || !hmac) return false;

  try {
    const expected = crypto.createHmac('sha256', secret).update(value).digest('hex');
    if (hmac.length !== expected.length) return false;
    const valid = crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
    return valid && Date.now() <= Number(value);
  } catch (err) {
    console.error("Erreur d'auth:", err);
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  // --- GET : liste de tous les produits avec leur catégorie ---
  if (req.method === 'GET') {
    try {
      const { rows } = await query(`
        SELECT
          p.id, p.name, p.description, p.price, p.image_url,
          p.is_available, p.created_at,
          p.category_id, c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        ORDER BY p.created_at DESC
      `);
      return res.status(200).json(rows);
    } catch (err) {
      console.error('❌ GET /api/produits error:', err.message);
      return res.status(500).json({ error: 'Erreur serveur', details: err.message, code: err.code || null });
    }
  }

  // --- POST : créer un nouveau produit ---
  if (req.method === 'POST') {
    const { name, description, price, imageUrl, categoryId } = req.body || {};
    if (!name || !imageUrl) {
      return res.status(400).json({ error: 'Nom et photo requis' });
    }

    try {
      const { rows } = await query(
        `INSERT INTO products (name, description, price, image_url, category_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [name.trim(), description || null, price || null, imageUrl, categoryId || null]
      );
      return res.status(200).json({ success: true, id: rows[0].id });
    } catch (err) {
      console.error('❌ POST /api/produits error:', err.message);
      return res.status(500).json({ error: 'Erreur serveur', details: err.message, code: err.code || null });
    }
  }

  // --- PUT : mise à jour d'un produit ---
  if (req.method === 'PUT') {
    const { id, name, description, price, imageUrl, categoryId, isAvailable } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id requis' });

    try {
      const { rows: existingRows } = await query('SELECT * FROM products WHERE id = $1', [id]);
      if (existingRows.length === 0) return res.status(404).json({ error: 'Produit introuvable' });
      const existing = existingRows[0];

      const merged = {
        name: name !== undefined ? name.trim() : existing.name,
        description: description !== undefined ? description : existing.description,
        price: price !== undefined ? price : existing.price,
        image_url: imageUrl !== undefined ? imageUrl : existing.image_url,
        category_id: categoryId !== undefined ? categoryId : existing.category_id,
        is_available: isAvailable !== undefined ? isAvailable : existing.is_available
      };

      await query(
        `UPDATE products SET
           name = $1, description = $2, price = $3,
           image_url = $4, category_id = $5, is_available = $6
         WHERE id = $7`,
        [
          merged.name,
          merged.description,
          merged.price,
          merged.image_url,
          merged.category_id,
          merged.is_available,
          id
        ]
      );
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('❌ PUT /api/produits error:', err.message);
      return res.status(500).json({ error: 'Erreur serveur', details: err.message, code: err.code || null });
    }
  }

  // --- DELETE : suppression d'un produit ---
  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id requis' });

    try {
      await query('DELETE FROM products WHERE id = $1', [id]);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('❌ DELETE /api/produits error:', err.message);
      return res.status(500).json({ error: 'Erreur serveur', details: err.message, code: err.code || null });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}
