// commandes.js — powers dashboard.html (orders list)

const STATUS_LABELS = {
  nouvelle: 'Nouvelle',
  confirmée: 'Confirmée',
  prête: 'Prête',
  livrée: 'Livrée'
};

const STATUS_CHIP_CLASS = {
  nouvelle: 'chip-new',
  confirmée: 'chip-confirmed',
  prête: 'chip-ready',
  livrée: 'chip-delivered'
};

const STATUS_FLOW = ['nouvelle', 'confirmée', 'prête', 'livrée'];

let allOrders = [];
let currentFilter = 'all';

const ordersList = document.getElementById('ordersList');
const filterRow = document.getElementById('filterBar');
const statNew = document.getElementById('statNew');
const statTotal = document.getElementById('statTotal');
const toast = document.getElementById('toast');
const toastText = document.getElementById('toastText');

function showToast(message) {
  toastText.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function formatDate(iso) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Aujourd'hui, ${time}`;
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}, ${time}`;
}

function nextStatus(status) {
  const idx = STATUS_FLOW.indexOf(status);
  if (idx === -1 || idx === STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[idx + 1];
}

function renderOrders() {
  const filtered = currentFilter === 'all'
    ? allOrders
    : allOrders.filter(o => o.status === currentFilter);

  if (filtered.length === 0) {
    ordersList.innerHTML = `<div class="empty-state">Aucune commande dans cette catégorie pour le moment.</div>`;
    return;
  }

  ordersList.innerHTML = filtered.map(order => {
    const statusClass = STATUS_CHIP_CLASS[order.status] || 'chip-new';
    const statusLabel = STATUS_LABELS[order.status] || order.status;
    const next = nextStatus(order.status);
    const productLabel = order.product_name
      ? order.product_name
      : (order.custom_description || 'Commande personnalisée');

    return `
      <div class="card order-card" data-id="${order.id}">
        <div class="order-col order-customer">
          <img class="order-thumb" src="${order.image_url || 'https://placehold.co/64x64/f4c6d4/3A2E2E?text=🥄'}" alt="${escapeHtml(order.customer_name)}" />
          <div>
            <div class="order-name">${escapeHtml(order.customer_name)}</div>
            <div class="order-meta">
              <span class="material-symbols-outlined" style="font-size:16px;">call</span>
              ${escapeHtml(order.customer_phone)}
            </div>
          </div>
        </div>

        <div class="order-col" style="border-left:1px solid var(--color-outline-variant);padding-left:24px;">
          <div style="font-weight:600;margin-bottom:4px;">${escapeHtml(productLabel)}</div>
          <div class="order-meta">
            <span class="material-symbols-outlined" style="font-size:16px;">schedule</span>
            ${formatDate(order.created_at)}
          </div>
        </div>

        <div class="order-col order-actions">
          <span class="chip ${statusClass}">
            ${order.status === 'nouvelle' ? '<span class="dot"></span>' : ''}
            ${statusLabel}
          </span>
          ${next ? `<button class="icon-btn" title="Passer à « ${STATUS_LABELS[next]} »" onclick="advanceStatus('${order.id}', '${next}')">
            <span class="material-symbols-outlined">arrow_forward</span>
          </button>` : ''}
          <button class="icon-btn" title="Voir détail" onclick="showDetail('${order.id}')">
            <span class="material-symbols-outlined">visibility</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function updateStats() {
  const today = new Date().toDateString();
  const newToday = allOrders.filter(o => o.status === 'nouvelle' && new Date(o.created_at).toDateString() === today).length;
  statNew.textContent = newToday;
  statTotal.textContent = allOrders.length;
}

async function loadOrders() {
  ordersList.innerHTML = `<div class="loading-state">Chargement des commandes...</div>`;
  try {
    const res = await fetch('/api/orders');
    if (!res.ok) throw new Error('Erreur de chargement');
    allOrders = await res.json();
    updateStats();
    renderOrders();
  } catch (err) {
    ordersList.innerHTML = `<div class="empty-state">Impossible de charger les commandes. Réessayez.</div>`;
  }
}

async function advanceStatus(orderId, newStatus) {
  try {
    const res = await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orderId, status: newStatus })
    });
    if (!res.ok) throw new Error();

    const order = allOrders.find(o => o.id === orderId);
    if (order) order.status = newStatus;
    updateStats();
    renderOrders();
    showToast(`Commande passée à « ${STATUS_LABELS[newStatus]} »`);
  } catch (err) {
    showToast('Erreur lors de la mise à jour du statut');
  }
}

function showDetail(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;
  alert(
    `Client: ${order.customer_name}\n` +
    `Téléphone: ${order.customer_phone}\n` +
    `Adresse: ${order.customer_address}\n` +
    `Produit: ${order.product_name || 'N/A'}\n` +
    `Message: ${order.custom_description || '—'}\n` +
    `Statut: ${STATUS_LABELS[order.status] || order.status}`
  );
}

filterRow.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-pill');
  if (!btn) return;
  filterRow.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = btn.dataset.status;
  renderOrders();
});

loadOrders();
