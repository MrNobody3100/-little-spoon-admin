import pg from 'pg';

const { Pool } = pg;

// Réutilise le pool entre les invocations de la fonction serverless (évite
// d'ouvrir une nouvelle connexion à chaque appel, ce qui épuiserait vite
// les connexions dispo côté Supabase).
let pool;

function getPool() {
  if (!pool) {
    const connectionString =
      process.env.POSTGRES_PRISMA_URL ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        'Aucune chaîne de connexion trouvée (POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING / POSTGRES_URL / DATABASE_URL)'
      );
    }

    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5
    });
  }
  return pool;
}

// Petit helper pratique pour ressembler à la syntaxe sql`...` de @vercel/postgres.
// Usage : await query('SELECT * FROM categories WHERE id = $1', [id])
export async function query(text, params) {
  const client = getPool();
  return client.query(text, params);
}
