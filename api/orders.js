import { sql } from '@vercel/postgres';
import crypto from 'crypto';

const COOKIE_NAME = 'tls_admin_session';
const VALID_STATUSES = ['nouvelle', 'confirmée', 'prête', 'livrée'];

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

  if (req.method === 'GET') {
    try {
      const { rows } = await sql`
        SELECT
          o.id,
          o.customer_name,
          o.customer_phone,
          o.customer_address,
          o.custom_description,
          o.status,
          o.created_at,
          p.name  AS product_name,
          p.image_url AS image_url
        FROM orders o
        LEFT JOIN products p ON p.id = o.product_id
        ORDER BY o.created_at DESC
      `;
      return res.status(200).json(rows);
    } catch (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  if (req.method === 'PATCH') {
    const { id, status } = req.body || {};

    if (!id || !status) {
      return res.status(400).json({ error: 'Champs manquants (id, status)' });
    }
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    try {
      const { rowCount } = await sql`
        UPDATE orders SET status = ${status} WHERE id = ${id}
      `;
      if (rowCount === 0) {
        return res.status(404).json({ error: 'Commande introuvable' });
      }
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}
