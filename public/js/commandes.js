// commandes.js — powers dashboard.html (orders table)

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
const filterRow = document.getElementById('filterRow');
const statNew = document.getElementById('statNew');
const statTotal = document.getElementById('statTotal');
const toast = document.getElementById('toast');
const toastText = document.getElementById('toastText');


/* =========================
   TOAST
========================= */

function showToast(message) {
  if (!toast || !toastText) return;

  toastText.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}


/* =========================
   DATE
========================= */

function formatDate(iso) {
  const d = new Date(iso);
  const today = new Date();

  const isToday =
    d.toDateString() === today.toDateString();

  const time = d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  if (isToday) {
    return `Aujourd'hui, ${time}`;
  }

  return `${d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short'
  })}, ${time}`;
}


/* =========================
   STATUS
========================= */

function nextStatus(status) {
  const index = STATUS_FLOW.indexOf(status);

  if (
    index === -1 ||
    index === STATUS_FLOW.length - 1
  ) {
    return null;
  }

  return STATUS_FLOW[index + 1];
}


/* =========================
   HTML SECURITY
========================= */

function escapeHtml(str) {
  const div = document.createElement('div');

  div.textContent = str ?? '';

  return div.innerHTML;
}


function escapeAttr(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}


/* =========================
   RENDER ORDERS
========================= */

function renderOrders() {

  const filtered =
    currentFilter === 'all'
      ? allOrders
      : allOrders.filter(
          order => order.status === currentFilter
        );


  /* No orders */

  if (filtered.length === 0) {

    ordersList.innerHTML = `
      <div class="empty-state">
        Aucune commande dans cette catégorie pour le moment.
      </div>
    `;

    return;
  }


  /* Create rows */

  const rows = filtered.map(order => {

    const statusClass =
      STATUS_CHIP_CLASS[order.status] || 'chip-new';

    const statusLabel =
      STATUS_LABELS[order.status] ||
      order.status ||
      '—';

    const next =
      nextStatus(order.status);


    const productLabel =
      order.product_name
        ? order.product_name
        : (
            order.custom_description ||
            'Commande personnalisée'
          );


    const imageUrl =
      order.image_url ||
      'https://placehold.co/64x64/f4c6d4/3A2E2E?text=Spoon';


    /* Next status button */

    const nextButton = next
      ? `
        <button
          class="status-btn"
          title="Passer à ${escapeAttr(
            STATUS_LABELS[next]
          )}"
          onclick="advanceStatus(
            '${escapeAttr(order.id)}',
            '${escapeAttr(next)}'
          )"
        >

          <span class="material-symbols-outlined">
            arrow_forward
          </span>

          ${escapeHtml(STATUS_LABELS[next])}

        </button>
      `
      : '';


    return `

      <tr data-id="${escapeAttr(order.id)}">

        <!-- CLIENT -->

        <td>

          <div class="order-client">

            <img
              class="order-thumb"
              src="${escapeAttr(imageUrl)}"
              alt="${escapeAttr(
                order.customer_name || 'Client'
              )}"
            />

            <div class="order-client-info">

              <div class="order-name">
                ${escapeHtml(
                  order.customer_name || 'Client'
                )}
              </div>

              <div class="order-phone">
                ${escapeHtml(
                  order.customer_phone || '—'
                )}
              </div>

            </div>

          </div>

        </td>


        <!-- COMMAND -->

        <td>

          <div class="order-product">
            ${escapeHtml(productLabel)}
          </div>

          <div class="order-message">
            ${escapeHtml(
              order.custom_description || '—'
            )}
          </div>

        </td>


        <!-- DATE / ADDRESS -->

        <td>

          <div class="order-date">
            ${formatDate(order.created_at)}
          </div>

          <div class="order-address">
            ${escapeHtml(
              order.customer_address || '—'
            )}
          </div>

        </td>


        <!-- STATUS -->

        <td class="order-status">

          <span class="chip ${statusClass}">

            ${
              order.status === 'nouvelle'
                ? '<span class="dot"></span>'
                : ''
            }

            ${escapeHtml(statusLabel)}

          </span>

        </td>


        <!-- ACTIONS -->

        <td>

          <div class="order-actions">

            ${nextButton}


            <button
              class="detail-btn"
              title="Voir le détail de la commande"
              onclick="showDetail(
                '${escapeAttr(order.id)}'
              )"
            >

              <span class="material-symbols-outlined">
                visibility
              </span>

              Détail

            </button>

          </div>

        </td>

      </tr>

    `;

  }).join('');


  /* Complete table */

  ordersList.innerHTML = `

    <table class="orders-table">

      <colgroup>

        <col style="width:23%">
        <col style="width:22%">
        <col style="width:22%">
        <col style="width:13%">
        <col style="width:20%">

      </colgroup>


      <thead>

        <tr>

          <th>Client</th>

          <th>Commande</th>

          <th>Date / Adresse</th>

          <th>Statut</th>

          <th>Actions</th>

        </tr>

      </thead>


      <tbody>

        ${rows}

      </tbody>

    </table>

  `;
}


/* =========================
   STATISTICS
========================= */

function updateStats() {

  const today =
    new Date().toDateString();


  const newToday =
    allOrders.filter(order =>

      order.status === 'nouvelle' &&

      new Date(
        order.created_at
      ).toDateString() === today

    ).length;


  statNew.textContent = newToday;

  statTotal.textContent =
    allOrders.length;
}


/* =========================
   LOAD ORDERS
========================= */

async function loadOrders() {

  ordersList.innerHTML = `
    <div class="loading-state">
      Chargement des commandes...
    </div>
  `;


  try {

    const res =
      await fetch('/api/orders');


    if (!res.ok) {

      throw new Error(
        'Erreur de chargement'
      );

    }


    allOrders =
      await res.json();


    updateStats();

    renderOrders();


  } catch (err) {

    console.error(
      'Erreur commandes:',
      err
    );


    ordersList.innerHTML = `
      <div class="empty-state">
        Impossible de charger les commandes.
        Réessayez.
      </div>
    `;

  }
}


/* =========================
   ADVANCE STATUS
========================= */

async function advanceStatus(
  orderId,
  newStatus
) {

  try {

    const res =
      await fetch('/api/orders', {

        method: 'PATCH',

        headers: {
          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({

          id: orderId,

          status: newStatus

        })

      });


    if (!res.ok) {

      throw new Error();

    }


    const order =
      allOrders.find(
        order =>
          String(order.id) ===
          String(orderId)
      );


    if (order) {

      order.status =
        newStatus;

    }


    updateStats();

    renderOrders();


    showToast(
      `Commande passée à « ${
        STATUS_LABELS[newStatus]
      } »`
    );


  } catch (err) {

    console.error(
      'Erreur changement statut:',
      err
    );


    showToast(
      'Erreur lors de la mise à jour du statut'
    );

  }
}


/* =========================
   SHOW DETAIL
========================= */

function showDetail(orderId) {

  const order =
    allOrders.find(
      order =>
        String(order.id) ===
        String(orderId)
    );


  if (!order) return;


  alert(

    `Client: ${
      order.customer_name || '—'
    }\n` +

    `Téléphone: ${
      order.customer_phone || '—'
    }\n` +

    `Adresse: ${
      order.customer_address || '—'
    }\n` +

    `Produit: ${
      order.product_name || 'N/A'
    }\n` +

    `Message: ${
      order.custom_description || '—'
    }\n` +

    `Statut: ${
      STATUS_LABELS[order.status] ||
      order.status ||
      '—'
    }`

  );
}


/* =========================
   FILTERS
========================= */

filterRow.addEventListener(
  'click',
  (e) => {

    const btn =
      e.target.closest(
        '.filter-pill'
      );


    if (!btn) return;


    filterRow
      .querySelectorAll(
        '.filter-pill'
      )
      .forEach(p =>
        p.classList.remove(
          'active'
        )
      );


    btn.classList.add(
      'active'
    );


    currentFilter =
      btn.dataset.status;


    renderOrders();

  }
);


/* =========================
   START
========================= */

loadOrders();
