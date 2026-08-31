// auth.js — handles the login form submission on login.html

const loginForm = document.getElementById('loginForm');

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const password = document.getElementById('password').value;
    const errorText = document.getElementById('errorText');
    const submitBtn = document.getElementById('submitBtn');

    errorText.textContent = '';
    submitBtn.disabled = true;
    submitBtn.querySelector('span').textContent = 'Connexion...';

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        window.location.href = 'dashboard.html';
      } else {
        errorText.textContent = data.error || 'Mot de passe incorrect.';
      }
    } catch (err) {
      errorText.textContent = 'Erreur de connexion. Réessayez.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.querySelector('span').textContent = 'Se connecter';
    }
  });
}
