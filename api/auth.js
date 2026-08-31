import crypto from 'crypto';

const COOKIE_NAME = 'tls_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

function sign(value, secret) {
  const hmac = crypto.createHmac('sha256', secret).update(value).digest('hex');
  return `${value}.${hmac}`;
}

function verify(signedValue, secret) {
  if (!signedValue) return null;
  const [value, hmac] = signedValue.split('.');
  if (!value || !hmac) return null;
  const expected = crypto.createHmac('sha256', secret).update(value).digest('hex');
  if (hmac.length !== expected.length) return null;
  const valid = crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
  return valid ? value : null;
}

function getCookie(req, name) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
}

export default async function handler(req, res) {
  const secret = process.env.SESSION_SECRET;

  if (req.method === 'POST') {
    // Login
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: 'Mot de passe requis' });
    }
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }

    const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
    const token = sign(String(expiresAt), secret);

    res.setHeader('Set-Cookie',
      `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SECONDS}`
    );
    return res.status(200).json({ success: true });
  }

  if (req.method === 'GET') {
    // Session check
    const raw = getCookie(req, COOKIE_NAME);
    const expiresAtStr = verify(raw, secret);
    if (!expiresAtStr || Date.now() > Number(expiresAtStr)) {
      return res.status(401).json({ error: 'Session invalide ou expirée' });
    }
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    // Logout
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}
