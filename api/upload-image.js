import { put } from '@vercel/blob';
import crypto from 'crypto';

const COOKIE_NAME = 'tls_admin_session';
const MAX_BYTES = 4 * 1024 * 1024; // 4MB

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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { filename, contentType, dataBase64 } = req.body || {};

  if (!filename || !contentType || !dataBase64) {
    return res.status(400).json({ error: 'Missing fields (filename, contentType, dataBase64)' });
  }
  if (!contentType.startsWith('image/')) {
    return res.status(400).json({ error: 'Only images are allowed' });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN is missing');
    return res.status(500).json({ error: 'Storage configuration missing' });
  }

  try {
    const buffer = Buffer.from(dataBase64, 'base64');
    if (buffer.length > MAX_BYTES) {
      return res.status(400).json({ error: 'Image too large (max 4MB)' });
    }

    const timestamp = Date.now();
    const safeName = `products/${timestamp}-${filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

    const blob = await put(safeName, buffer, {
      access: 'public',
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return res.status(200).json({ url: blob.url });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Upload error: ' + err.message });
  }
}
