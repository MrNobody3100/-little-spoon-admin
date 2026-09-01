import { sql } from '@vercel/postgres';
import crypto from 'crypto';

const COOKIE_NAME = 'tls_admin_session';

function isAuthorized(req) {
  try {
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      console.error('❌ SESSION_SECRET is NOT set in environment');
      return false;
    }

    const cookieHeader = req.headers.cookie || '';
    const match = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith(`${COOKIE_NAME}=`));
    if (!match) {
      console.log('⚠️ No cookie found');
      return false;
    }

    const raw = decodeURIComponent(match.split('=').slice(1).join('='));
    const [value, hmac] = raw.split('.');
    if (!value || !hmac) {
      console.log('⚠️ Invalid cookie format');
      return false;
    }

    const expected = crypto.createHmac('sha256', secret).update(value).digest('hex');
    if (hmac.length !== expected.length) {
      console.log('⚠️ HMAC length mismatch');
      return false;
    }
    
    const valid = crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
    const isExpired = Date.now() > Number(value);
    
    if (isExpired) console.log('⚠️ Session expired');
    if (!valid) console.log('⚠️ Invalid signature');
    
    return valid && !isExpired;
  } catch (err) {
    console.error('❌ Auth error:', err.message);
    return false;
  }
}

export default async function handler(req, res) {
  console.log(`📡 ${req.method} /api/categories - ${new Date().toISOString()}`);

  // --- First, check database connection ---
  try {
    const result = await sql`SELECT NOW() as current_time`;
    console.log('✅ Database connected successfully at:', result.rows[0].current_time);
  } catch (dbErr) {
    console.error('❌ Database connection FAILED:', dbErr.message);
    console.error('Stack:', dbErr.stack);
    return res.status(500).json({ 
      error: 'Database connection failed', 
      details: dbErr.message,
      hint: 'Check if Vercel Postgres is attached to your project'
    });
  }

  // --- Check authentication ---
  const authorized = isAuthorized(req);
  console.log(`🔐 Authenticated: ${authorized}`);
  
  if (!authorized) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  // --- GET all categories ---
  if (req.method === 'GET') {
    try {
      console.log('📥 Fetching categories...');
      const { rows } = await sql`
        SELECT id, name, slug, sort_order, created_at 
        FROM categories 
        ORDER BY sort_order ASC, name ASC
      `;
      console.log(`✅ Found ${rows.length} categories`);
      return res.status(200).json(rows);
    } catch (err) {
      console.error('❌ GET error:', err.message);
      console.error('Full error:', err);
      
      // Check if table exists
      if (err.message.includes('relation "categories" does not exist')) {
        return res.status(500).json({ 
          error: 'Categories table does not exist', 
          details: 'Please create the categories table in your database',
          hint: 'Run: CREATE TABLE categories (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, sort_order INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())'
        });
      }
      
      return res.status(500).json({ error: 'Erreur serveur', details: err.message });
    }
  }

  // --- POST create category ---
  if (req.method === 'POST') {
    const { name, slug, sort_order } = req.body || {};
    console.log(`📝 Creating category: name="${name}", slug="${slug}", sort_order=${sort_order || 0}`);

    // Validate inputs
    if (!name || !name.trim()) {
      console.log('❌ Missing name');
      return res.status(400).json({ error: 'Nom requis' });
    }
    if (!slug || !slug.trim()) {
      console.log('❌ Missing slug');
      return res.status(400).json({ error: 'Slug requis' });
    }

    try {
      // Check if slug already exists
      const { rows: existing } = await sql`
        SELECT id FROM categories WHERE slug = ${slug.trim()}
      `;
      if (existing.length > 0) {
        console.log(`⚠️ Slug "${slug}" already exists`);
        return res.status(400).json({ error: 'Ce slug est déjà utilisé' });
      }

      // Insert new category
      const { rows } = await sql`
        INSERT INTO categories (name, slug, sort_order)
        VALUES (${name.trim()}, ${slug.trim()}, ${sort_order || 0})
        RETURNING id
      `;
      
      console.log(`✅ Category created with ID: ${rows[0].id}`);
      return res.status(200).json({ success: true, id: rows[0].id });
    } catch (err) {
      console.error('❌ POST error:', err.message);
      console.error('Full error:', err);
      
      if (err.message.includes('duplicate key')) {
        return res.status(400).json({ error: 'Ce slug existe déjà' });
      }
      
      return res.status(500).json({ 
        error: 'Erreur serveur', 
        details: err.message,
        hint: 'Check if categories table exists with correct columns (id, name, slug, sort_order, created_at)'
      });
    }
  }

  // --- PUT update category ---
  if (req.method === 'PUT') {
    const { id, name, slug, sort_order } = req.body || {};
    console.log(`✏️ Updating category: id="${id}", name="${name}", slug="${slug}"`);

    if (!id) return res.status(400).json({ error: 'id requis' });
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nom requis' });
    if (!slug || !slug.trim()) return res.status(400).json({ error: 'Slug requis' });

    try {
      // Check if category exists
      const { rows: existing } = await sql`
        SELECT id FROM categories WHERE id = ${id}
      `;
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Catégorie introuvable' });
      }

      // Check if slug is taken by another category
      const { rows: slugExists } = await sql`
        SELECT id FROM categories WHERE slug = ${slug.trim()} AND id != ${id}
      `;
      if (slugExists.length > 0) {
        return res.status(400).json({ error: 'Ce slug est déjà utilisé par une autre catégorie' });
      }

      const { rowCount } = await sql`
        UPDATE categories 
        SET name = ${name.trim()}, slug = ${slug.trim()}, sort_order = ${sort_order || 0}
        WHERE id = ${id}
      `;
      
      console.log(`✅ Category ${id} updated (${rowCount} rows affected)`);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('❌ PUT error:', err.message);
      return res.status(500).json({ error: 'Erreur serveur', details: err.message });
    }
  }

  // --- DELETE category ---
  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    console.log(`🗑️ Deleting category: id="${id}"`);

    if (!id) return res.status(400).json({ error: 'id requis' });

    try {
      // Check if category exists
      const { rows: existing } = await sql`
        SELECT id FROM categories WHERE id = ${id}
      `;
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Catégorie introuvable' });
      }

      // Check if category is used by products
      const { rows: products } = await sql`
        SELECT id FROM products WHERE category_id = ${id} LIMIT 1
      `;
      if (products.length > 0) {
        return res.status(400).json({ error: 'Cette catégorie est utilisée par des produits' });
      }

      await sql`DELETE FROM categories WHERE id = ${id}`;
      console.log(`✅ Category ${id} deleted`);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('❌ DELETE error:', err.message);
      return res.status(500).json({ error: 'Erreur serveur', details: err.message });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}
