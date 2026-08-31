// auth-check.js — include on every protected admin page (dashboard, produits, categories).
// Verifies the session cookie server-side and redirects to login.html if invalid.

(async function checkSession() {
  try {
    const res = await fetch('/api/auth', { method: 'GET' });
    if (!res.ok) {
      window.location.href = 'login.html';
    }
  } catch (err) {
    window.location.href = 'login.html';
  }
})();

async function logout() {
  try {
    await fetch('/api/auth', { method: 'DELETE' });
  } finally {
    window.location.href = 'login.html';
  }
}
