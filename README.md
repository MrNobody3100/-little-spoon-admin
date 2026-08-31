# The Little Spoon — Admin Site

Vanilla HTML/CSS/JS admin dashboard, deployed as its own Vercel project.

## What's included so far
- `public/login.html` — password login
- `public/dashboard.html` — orders list (live data, status updates, filters)
- `public/css/style.css` — shared design system (matches DESIGN.md)
- `public/js/auth.js`, `auth-check.js`, `commandes.js`
- `api/auth.js` — login / session check / logout (signed HttpOnly cookie)
- `api/orders.js` — GET orders (joined with product name/photo), PATCH status

Not yet built (next steps): `produits.html` + `api/products.js` (CRUD + photo
upload to Vercel Blob), `categories.html` + `api/categories.js`.

## Environment variables (set in Vercel → Project → Settings → Environment Variables)
```
POSTGRES_URL=          # same value as the client-site project
BLOB_READ_WRITE_TOKEN=
ADMIN_PASSWORD=        # the password admins type on login.html
SESSION_SECRET=        # any long random string, used to sign the session cookie
```

## Database
Run the SQL from the architecture doc (`categories`, `products`, `orders`
tables) once, via the Vercel Postgres dashboard's Query tab, before this
will show any data.

## Deploying
1. Push this folder to its own GitHub repo.
2. Import it into Vercel as a new project.
3. Add the environment variables above.
4. Every `git push` redeploys automatically.

## Local testing
Vercel dev server reproduces the serverless functions locally:
```
npm install -g vercel
vercel dev
```
Then open `http://localhost:3000/login.html`.
