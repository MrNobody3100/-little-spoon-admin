// commandes.js — alimente le tableau de commandes de dashboard.html

const STATUS_LABELS = {
  nouvelle: 'Nouvelle',
  confirmée: 'Confirmée',
  prête: 'Prête',
  livrée: 'Livrée'
};

const STATUS_CHIP_CLASS = {
  nouvelle: 'status-new',
  confirmée: 'status-confirmed',
  prête: 'status-ready',
  livrée: 'status-delivered'
};

// Icône + libellé du bouton qui fait avancer une commande à l'étape suivante
const STATUS_NEXT_ACTION = {
  nouvelle: { next: 'confirmée', icon: 'ph-check', label: 'Confirmer' },
  confirmée: { next: 'prête', icon: 'ph-package', label: 'Marquer prête' },
  prête: { next: 'livrée', icon: 'ph-truck', label: 'Marquer livrée' },
  livrée: null
};

let allOrders = [];
let currentFilter = 'all';

const ordersList = document.getElementById('ordersList');
const filterBar = document.getElementById('filterBar');

function formatDate(iso) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Aujourd'hui, ${time}`;
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}, ${time}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function renderOrders() {
  const filtered = currentFilter === 'all'
    ? allOrders
    : allOrders.filter(o => o.status === currentFilter);

  if (filtered.length === 0) {
    ordersList.innerHTML = `
      <div class="empty-state">
        <i class="ph ph-tray"></i>
        <h3>Aucune commande ici</h3>
        <p>${currentFilter === 'all' ? 'Les nouvelles commandes du site client apparaîtront ici.' : 'Aucune commande dans ce statut pour le moment.'}</p>
      </div>
    `;
    return;
  }

  let rows = filtered.map(order => {
    const statusClass = STATUS_CHIP_CLASS[order.status] || 'status-new';
    const statusLabel = STATUS_LABELS[order.status] || order.status;
    const action = STATUS_NEXT_ACTION[order.status];
    const productLabel = order.product_name || 'Commande personnalisée';

    return `
      <tr data-id="${order.id}">
        <td>
          <div class="order-client">
            <div class="order-avatar"><i class="ph-fill ph-user"></i></div>
            <div class="order-client-info">
              <div class="order-name">${escapeHtml(order.customer_name)}</div>
              <div class="order-sub"><i class="ph ph-phone"></i> ${escapeHtml(order.customer_phone)}</div>
            </div>
          </div>
        </td>
        <td>
          <div class="order-product">${escapeHtml(productLabel)}</div>
          ${order.custom_description ? `<div class="order-sub order-message" title="${escapeHtml(order.custom_description)}"><i class="ph ph-chat-text"></i> ${escapeHtml(order.custom_description)}</div>` : ''}
        </td>
        <td>
          <div class="order-sub"><i class="ph ph-map-pin"></i> ${escapeHtml(order.customer_address)}</div>
        </td>
        <td>
          <div class="order-sub"><i class="ph ph-clock"></i> ${formatDate(order.created_at)}</div>
        </td>
        <td>
          <span class="status-chip ${statusClass}">
            ${order.status === 'nouvelle' ? '<span class="status-dot"></span>' : `<i class="ph ph-check-circle"></i>`}
            ${statusLabel}
          </span>
        </td>
        <td class="col-actions">
          <div class="row-actions">
            ${action ? `
              <button class="action-btn primary-action" title="${action.label}" onclick="advanceStatus('${order.id}', '${action.next}')">
                <i class="ph-bold ${action.icon}"></i>
              </button>
            ` : `
              <span class="action-btn done" title="Commande livrée">
                <i class="ph-fill ph-check-circle"></i>
              </span>
            `}
            <button class="action-btn" title="Voir le détail" onclick="showDetail('${order.id}')">
              <i class="ph ph-eye"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  ordersList.innerHTML = `
    <div class="table-scroll">
      <table class="orders-table">
        <thead>
          <tr>
            <th>Client</th>
            <th>Produit</th>
            <th>Adresse</th>
            <th>Reçue</th>
            <th>Statut</th>
            <th class="col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function updateStats() {
  const today = new Date().toDateString();
  const newToday = allOrders.filter(o => o.status === 'nouvelle' && new Date(o.created_at).toDateString() === today).length;

  const statNewNumber = document.getElementById('statNewNumber');
  const statTotalNumber = document.getElementById('statTotalNumber');
  if (statNewNumber) statNewNumber.textContent = newToday;
  if (statTotalNumber) statTotalNumber.textContent = allOrders.length;

  const counts = { all: allOrders.length, nouvelle: 0, confirmée: 0, prête: 0, livrée: 0 };
  allOrders.forEach(o => { if (counts[o.status] !== undefined) counts[o.status]++; });
  Object.keys(counts).forEach(key => {
    const el = document.getElementById('count' + key.charAt(0).toUpperCase() + key.slice(1));
    if (el) el.textContent = counts[key];
  });

  document.dispatchEvent(new CustomEvent('statsUpdated', { detail: { newToday, total: allOrders.length } }));
  document.dispatchEvent(new CustomEvent('ordersUpdated', { detail: { counts } }));
}

async function loadOrders() {
  ordersList.innerHTML = `
    <div class="loading-state">
      <div class="spinner" aria-hidden="true"></div>
      <p>Chargement des commandes…</p>
    </div>
  `;
  try {
    const res = await fetch('/api/orders');
    if (!res.ok) throw new Error('Erreur de chargement');
    allOrders = await res.json();
    updateStats();
    renderOrders();
  } catch (err) {
    ordersList.innerHTML = `
      <div class="empty-state">
        <i class="ph ph-warning-circle"></i>
        <h3>Impossible de charger les commandes</h3>
        <p>${escapeHtml(err.message)}</p>
      </div>
    `;
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
    if (window.showToast) window.showToast(`Commande passée à « ${STATUS_LABELS[newStatus]} »`, 'success');
  } catch (err) {
    if (window.showToast) window.showToast('Erreur lors de la mise à jour du statut', 'error');
  }
}
window.advanceStatus = advanceStatus;

function showDetail(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;
  alert(
    `Client : ${order.customer_name}\n` +
    `Téléphone : ${order.customer_phone}\n` +
    `Adresse : ${order.customer_address}\n` +
    `Produit : ${order.product_name || 'N/A'}\n` +
    `Message : ${order.custom_description || '—'}\n` +
    `Statut : ${STATUS_LABELS[order.status] || order.status}`
  );
}
window.showDetail = showDetail;

/* =========================
   FILTRES
========================= */
if (filterBar) {
  filterBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-pill');
    if (!btn) return;

    filterBar.querySelectorAll('.filter-pill').forEach(p => {
      p.classList.remove('active');
      p.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');

    currentFilter = btn.dataset.status;
    renderOrders();
  });
}

/* =========================
   START
========================= */
loadOrders();
