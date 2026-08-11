(function () {
  const grid = document.getElementById('pos-order-grid');
  if (!grid) return;

  const feedUrl = grid.dataset.feedUrl;
  const actionTemplate = grid.dataset.actionUrlTemplate || '';
  const mode = grid.dataset.mode || 'orders';
  const csrf = (window.POS_REALTIME && window.POS_REALTIME.csrfToken) || '';
  let refreshTimer = null;

  function actionUrl(orderId) {
    return actionTemplate.replace('/0/', '/' + orderId + '/');
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderOptions(opts) {
    if (!opts || !opts.length) return '';
    return (
      '<div class="pos-order-opts">' +
      opts.map(function (o) { return '· ' + escapeHtml(o.name); }).join(' ') +
      '</div>'
    );
  }

  function renderActions(order) {
    const url = actionUrl(order.id);
    if (order.status === 'pending') {
      return (
        '<form method="post" action="' + url + '" class="pos-inline-form js-order-action">' +
        '<input type="hidden" name="csrfmiddlewaretoken" value="' + csrf + '">' +
        '<input type="hidden" name="action" value="accept">' +
        '<select name="prep_minutes" class="pos-input pos-input-sm" style="width:auto;display:inline-block;">' +
        '<option value="10">10m</option><option value="15" selected>15m</option>' +
        '<option value="20">20m</option><option value="30">30m</option><option value="45">45m</option></select>' +
        '<button type="submit" class="pos-btn pos-btn-primary">Aceptar</button></form>' +
        '<form method="post" action="' + url + '" class="pos-inline-form js-order-action" data-confirm="¿Rechazar este pedido?">' +
        '<input type="hidden" name="csrfmiddlewaretoken" value="' + csrf + '">' +
        '<input type="hidden" name="action" value="reject">' +
        '<button type="submit" class="pos-btn">Rechazar</button></form>'
      );
    }
    if (order.status === 'accepted' || order.status === 'preparing') {
      return (
        '<form method="post" action="' + url + '" class="pos-inline-form js-order-action">' +
        '<input type="hidden" name="csrfmiddlewaretoken" value="' + csrf + '">' +
        '<input type="hidden" name="action" value="status">' +
        '<input type="hidden" name="status" value="ready">' +
        '<button type="submit" class="pos-btn pos-btn-primary">Listo</button></form>'
      );
    }
    if (order.status === 'ready' && order.source !== 'zinapp') {
      return (
        '<form method="post" action="' + url + '" class="pos-inline-form js-order-action">' +
        '<input type="hidden" name="csrfmiddlewaretoken" value="' + csrf + '">' +
        '<input type="hidden" name="action" value="status">' +
        '<input type="hidden" name="status" value="delivered">' +
        '<button type="submit" class="pos-btn pos-btn-primary">Entregar / Completar</button></form>'
      );
    }
    if (order.status === 'ready' && order.source === 'zinapp') {
      return '<span class="pos-hint">Esperando repartidor</span>';
    }
    return '';
  }

  function renderCard(order) {
    const items = (order.items || [])
      .map(function (item) {
        return (
          '<li><strong>' +
          item.quantity +
          'x</strong> ' +
          escapeHtml(item.name) +
          renderOptions(item.options) +
          (item.notes ? '<div class="pos-order-notes">' + escapeHtml(item.notes) + '</div>' : '') +
          '</li>'
        );
      })
      .join('');
    return (
      '<article class="pos-order-card status-' +
      escapeHtml(order.status) +
      ' source-' +
      escapeHtml(order.source) +
      '" data-order-id="' +
      order.id +
      '">' +
      '<header class="pos-order-card-head"><strong>' +
      escapeHtml(order.code) +
      '</strong><span class="pos-pill">' +
      escapeHtml(order.status_display) +
      '</span><span class="pos-pill pos-pill-muted">' +
      escapeHtml(order.source_display) +
      '</span></header>' +
      '<div class="pos-order-meta">' +
      escapeHtml(order.customer_name || 'Mostrador') +
      ' · $' +
      escapeHtml(order.total) +
      ' · ' +
      escapeHtml(order.payment_method_display) +
      '</div>' +
      '<ul class="pos-order-items">' +
      items +
      '</ul>' +
      (order.delivery_notes
        ? '<p class="pos-order-notes"><strong>Notas:</strong> ' + escapeHtml(order.delivery_notes) + '</p>'
        : '') +
      '<div class="pos-order-actions">' +
      renderActions(order) +
      '</div></article>'
    );
  }

  async function refresh() {
    if (!feedUrl) return;
    try {
      const res = await fetch(feedUrl, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      if (!res.ok) return;
      const data = await res.json();
      const orders = data.orders || [];
      if (!orders.length) {
        grid.innerHTML = '<p class="pos-empty" id="pos-empty">No hay pedidos en este filtro.</p>';
        return;
      }
      grid.innerHTML = orders.map(renderCard).join('');
    } catch (e) {
      /* ignore */
    }
  }

  function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 250);
  }

  window.addEventListener('pos:orders-refresh', scheduleRefresh);

  grid.addEventListener('submit', async function (ev) {
    const form = ev.target;
    if (!form.classList.contains('js-order-action') && !form.classList.contains('pos-inline-form')) {
      return;
    }
    if (form.dataset.confirm && !window.confirm(form.dataset.confirm)) {
      ev.preventDefault();
      return;
    }
    // Prefer AJAX to avoid full reload; fallback to normal submit if fails.
    ev.preventDefault();
    const body = new FormData(form);
    try {
      const res = await fetch(form.action + '?format=json', {
        method: 'POST',
        body: body,
        headers: { Accept: 'application/json', 'X-CSRFToken': csrf },
        credentials: 'same-origin',
      });
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        alert(data.detail || 'No se pudo actualizar el pedido.');
        return;
      }
      scheduleRefresh();
    } catch (e) {
      form.submit();
    }
  });
})();
