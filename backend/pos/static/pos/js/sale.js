(function () {
  const catalog = window.POS_CATALOG || [];
  const byId = Object.fromEntries(catalog.map((p) => [String(p.id), p]));
  const cart = [];
  let pendingProduct = null;

  const linesEl = document.getElementById('pos-cart-lines');
  const subtotalEl = document.getElementById('pos-subtotal');
  const totalEl = document.getElementById('pos-total');
  const cartJsonEl = document.getElementById('pos-cart-json');
  const discountInput = document.getElementById('pos-discount');
  const discountField = document.getElementById('pos-discount-field');
  const paymentEl = document.getElementById('pos-payment-method');
  const cashFields = document.getElementById('pos-cash-fields');
  const receivedEl = document.getElementById('pos-received');
  const changeEl = document.getElementById('pos-change');
  const dialog = document.getElementById('pos-options-dialog');
  const optionsBody = document.getElementById('pos-options-body');
  const optionsTitle = document.getElementById('pos-options-title');
  const notesEl = document.getElementById('pos-item-notes');
  const form = document.getElementById('pos-checkout-form');
  let chargeLocked = false;

  function money(n) {
    return '$' + Number(n).toFixed(2);
  }

  function cartPayload() {
    return cart.map((line) => ({
      product_id: line.product_id,
      quantity: line.quantity,
      option_ids: line.option_ids,
      notes: line.notes || '',
    }));
  }

  function syncLocalTotals() {
    // Totales definitivos vienen del backend; esto es UX provisional.
    let subtotal = 0;
    cart.forEach((line) => {
      const p = byId[String(line.product_id)];
      if (!p) return;
      let unit = Number(p.price);
      (line.option_ids || []).forEach((oid) => {
        p.groups.forEach((g) => {
          g.options.forEach((o) => {
            if (o.id === oid) unit += Number(o.price_delta);
          });
        });
      });
      subtotal += unit * line.quantity;
    });
    const discount = Math.max(0, Number(discountInput.value || 0));
    const total = Math.max(0, subtotal - discount);
    subtotalEl.textContent = money(subtotal);
    totalEl.textContent = money(total);
    discountField.value = String(discount);
    cartJsonEl.value = JSON.stringify(cartPayload());
    updateChange(total);
    refreshPreview();
  }

  function updateChange(total) {
    if (paymentEl.value !== 'cash') {
      changeEl.textContent = money(0);
      return;
    }
    const received = Number(receivedEl.value || 0);
    changeEl.textContent = money(Math.max(0, received - total));
  }

  async function refreshPreview() {
    if (!window.POS_PREVIEW_URL || !cart.length) return;
    try {
      const res = await fetch(window.POS_PREVIEW_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': window.POS_CSRF,
        },
        body: JSON.stringify({
          items: cartPayload(),
          discount_amount: discountInput.value || '0',
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      subtotalEl.textContent = money(data.subtotal);
      totalEl.textContent = money(data.total);
      updateChange(Number(data.total));
    } catch (e) {
      /* ignore preview errors */
    }
  }

  function renderCart() {
    linesEl.innerHTML = '';
    cart.forEach((line, idx) => {
      const p = byId[String(line.product_id)];
      const row = document.createElement('div');
      row.className = 'pos-cart-line';
      const opts = (line.option_ids || [])
        .map((oid) => {
          for (const g of p.groups) {
            for (const o of g.options) if (o.id === oid) return o.name;
          }
          return null;
        })
        .filter(Boolean)
        .join(', ');
      row.innerHTML =
        '<div><strong>' +
        (p ? p.name : line.product_id) +
        '</strong>' +
        (opts ? '<div style="color:#9aa8b8;font-size:0.85rem">' + opts + '</div>' : '') +
        (line.notes ? '<div style="color:#9aa8b8;font-size:0.85rem">' + line.notes + '</div>' : '') +
        '</div>';
      const actions = document.createElement('div');
      actions.className = 'pos-cart-line-actions';
      const minus = document.createElement('button');
      minus.type = 'button';
      minus.className = 'pos-btn';
      minus.textContent = '−';
      minus.onclick = () => {
        line.quantity -= 1;
        if (line.quantity <= 0) cart.splice(idx, 1);
        renderCart();
      };
      const qty = document.createElement('span');
      qty.textContent = String(line.quantity);
      const plus = document.createElement('button');
      plus.type = 'button';
      plus.className = 'pos-btn';
      plus.textContent = '+';
      plus.onclick = () => {
        line.quantity += 1;
        renderCart();
      };
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'pos-btn';
      remove.textContent = '✕';
      remove.onclick = () => {
        cart.splice(idx, 1);
        renderCart();
      };
      actions.append(minus, qty, plus, remove);
      row.appendChild(actions);
      linesEl.appendChild(row);
    });
    syncLocalTotals();
  }

  function openOptions(product) {
    pendingProduct = product;
    optionsTitle.textContent = product.name;
    notesEl.value = '';
    optionsBody.innerHTML = '';
    product.groups.forEach((g) => {
      const wrap = document.createElement('div');
      wrap.style.marginBottom = '0.75rem';
      wrap.innerHTML =
        '<strong>' +
        g.name +
        '</strong> <span style="color:#9aa8b8">(min ' +
        g.min_select +
        ' / max ' +
        g.max_select +
        ')</span>';
      g.options.forEach((o) => {
        const label = document.createElement('label');
        label.style.display = 'block';
        label.style.marginTop = '0.35rem';
        const input = document.createElement('input');
        input.type = g.max_select > 1 ? 'checkbox' : 'radio';
        input.name = 'group_' + g.id;
        input.value = String(o.id);
        input.dataset.groupId = String(g.id);
        label.appendChild(input);
        label.appendChild(
          document.createTextNode(
            ' ' + o.name + (Number(o.price_delta) ? ' (+$' + Number(o.price_delta).toFixed(2) + ')' : '')
          )
        );
        wrap.appendChild(label);
      });
      optionsBody.appendChild(wrap);
    });
    if (typeof dialog.showModal === 'function') dialog.showModal();
  }

  function addProduct(product, optionIds, notes) {
    const key = product.id + ':' + optionIds.slice().sort().join(',') + ':' + (notes || '');
    const existing = cart.find((l) => l._key === key);
    if (existing) existing.quantity += 1;
    else
      cart.push({
        _key: key,
        product_id: product.id,
        quantity: 1,
        option_ids: optionIds,
        notes: notes || '',
      });
    renderCart();
  }

  document.querySelectorAll('.pos-product-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const product = byId[btn.dataset.productId];
      if (!product) return;
      if (product.groups && product.groups.length) openOptions(product);
      else addProduct(product, [], '');
    });
  });

  document.getElementById('pos-options-form').addEventListener('close', () => {
    if (dialog.returnValue !== 'ok' || !pendingProduct) return;
    const selected = [];
    optionsBody.querySelectorAll('input:checked').forEach((el) => selected.push(Number(el.value)));
    addProduct(pendingProduct, selected, notesEl.value.trim());
    pendingProduct = null;
  });

  discountInput.addEventListener('input', syncLocalTotals);
  receivedEl.addEventListener('input', () => {
    const total = Number(String(totalEl.textContent).replace('$', '')) || 0;
    updateChange(total);
  });
  paymentEl.addEventListener('change', () => {
    cashFields.style.display = paymentEl.value === 'cash' ? 'block' : 'none';
    syncLocalTotals();
  });
  cashFields.style.display = paymentEl.value === 'cash' ? 'block' : 'none';

  form.addEventListener('submit', (ev) => {
    if (!cart.length) {
      ev.preventDefault();
      alert('Agrega productos al carrito.');
      return;
    }
    if (chargeLocked) {
      ev.preventDefault();
      return;
    }
    chargeLocked = true;
    const btn = document.getElementById('pos-charge-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Procesando…';
    }
    cartJsonEl.value = JSON.stringify(cartPayload());
    discountField.value = String(discountInput.value || 0);
  });

  renderCart();
})();
