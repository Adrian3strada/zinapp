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
  const optionsForm = document.getElementById('pos-options-form');
  const optionsBody = document.getElementById('pos-options-body');
  const optionsTitle = document.getElementById('pos-options-title');
  const notesEl = document.getElementById('pos-item-notes');
  const form = document.getElementById('pos-checkout-form');
  let chargeLocked = false;

  function money(n) {
    return '$' + Number(n).toFixed(2);
  }

  function asId(value) {
    return Number(value);
  }

  function findOption(product, optionId) {
    const oid = asId(optionId);
    for (const g of product.groups || []) {
      for (const o of g.options || []) {
        if (asId(o.id) === oid) return o;
      }
    }
    return null;
  }

  function cartPayload() {
    return cart.map((line) => ({
      product_id: line.product_id,
      quantity: line.quantity,
      option_ids: (line.option_ids || []).map(asId),
      notes: line.notes || '',
    }));
  }

  function lineUnitPrice(line) {
    const p = byId[String(line.product_id)];
    if (!p) return 0;
    let unit = Number(p.price) || 0;
    (line.option_ids || []).forEach((oid) => {
      const opt = findOption(p, oid);
      if (opt) unit += Number(opt.price_delta) || 0;
    });
    return unit;
  }

  function syncLocalTotals() {
    let subtotal = 0;
    cart.forEach((line) => {
      subtotal += lineUnitPrice(line) * line.quantity;
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
          Accept: 'application/json',
        },
        credentials: 'same-origin',
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
    if (!cart.length) {
      linesEl.innerHTML = '<p class="pos-empty" style="padding:1rem;margin:0;">Carrito vacío</p>';
    }
    cart.forEach((line, idx) => {
      const p = byId[String(line.product_id)];
      const row = document.createElement('div');
      row.className = 'pos-cart-line';
      const opts = (line.option_ids || [])
        .map((oid) => {
          const opt = p ? findOption(p, oid) : null;
          return opt ? opt.name : null;
        })
        .filter(Boolean)
        .join(', ');
      row.innerHTML =
        '<div><strong>' +
        (p ? p.name : line.product_id) +
        '</strong>' +
        (opts ? '<div class="pos-order-opts">' + opts + '</div>' : '') +
        (line.notes ? '<div class="pos-order-notes">' + line.notes + '</div>' : '') +
        '<div class="pos-order-meta">' + money(lineUnitPrice(line) * line.quantity) + '</div>' +
        '</div>';
      const actions = document.createElement('div');
      actions.className = 'pos-cart-line-actions';
      const minus = document.createElement('button');
      minus.type = 'button';
      minus.className = 'pos-btn pos-btn-sm';
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
      plus.className = 'pos-btn pos-btn-sm';
      plus.textContent = '+';
      plus.onclick = () => {
        line.quantity += 1;
        renderCart();
      };
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'pos-btn pos-btn-sm';
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

  function openDialog() {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function closeDialog(returnValue) {
    if (typeof dialog.close === 'function') dialog.close(returnValue || '');
    else {
      dialog.removeAttribute('open');
      dialog.returnValue = returnValue || '';
      dialog.dispatchEvent(new Event('close'));
    }
  }

  function openOptions(product) {
    pendingProduct = product;
    optionsTitle.textContent = product.name;
    notesEl.value = '';
    optionsBody.innerHTML = '';
    (product.groups || []).forEach((g) => {
      const wrap = document.createElement('fieldset');
      wrap.className = 'pos-option-group';
      wrap.dataset.groupId = String(g.id);
      wrap.dataset.minSelect = String(g.min_select || 0);
      wrap.dataset.maxSelect = String(g.max_select || 1);
      const legend = document.createElement('legend');
      legend.innerHTML =
        '<strong>' +
        g.name +
        '</strong> <span class="pos-muted-inline">(min ' +
        g.min_select +
        ' / max ' +
        g.max_select +
        ')</span>';
      wrap.appendChild(legend);
      (g.options || []).forEach((o, idx) => {
        const label = document.createElement('label');
        label.className = 'pos-option-choice';
        const input = document.createElement('input');
        input.type = Number(g.max_select) > 1 ? 'checkbox' : 'radio';
        input.name = 'group_' + g.id;
        input.value = String(o.id);
        input.dataset.groupId = String(g.id);
        // Preselecciona la primera opción en grupos obligatorios de 1.
        if (Number(g.min_select) >= 1 && Number(g.max_select) === 1 && idx === 0) {
          input.checked = true;
        }
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
    openDialog();
  }

  function collectSelectedOptionIds() {
    const selected = [];
    optionsBody.querySelectorAll('input:checked').forEach((el) => {
      selected.push(asId(el.value));
    });
    return selected;
  }

  function validateOptions(product) {
    for (const g of product.groups || []) {
      const checked = optionsBody.querySelectorAll('input[name="group_' + g.id + '"]:checked');
      const count = checked.length;
      const minSel = Number(g.min_select) || 0;
      const maxSel = Number(g.max_select) || 1;
      if (count < minSel) {
        return 'Elige al menos ' + minSel + ' opción(es) en «' + g.name + '».';
      }
      if (count > maxSel) {
        return 'Solo puedes elegir hasta ' + maxSel + ' en «' + g.name + '».';
      }
    }
    return '';
  }

  function addProduct(product, optionIds, notes) {
    const ids = (optionIds || []).map(asId).sort(function (a, b) { return a - b; });
    const key = product.id + ':' + ids.join(',') + ':' + (notes || '');
    const existing = cart.find((l) => l._key === key);
    if (existing) existing.quantity += 1;
    else {
      cart.push({
        _key: key,
        product_id: product.id,
        quantity: 1,
        option_ids: ids,
        notes: notes || '',
      });
    }
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

  // Validar antes de cerrar el dialog (method=dialog).
  optionsForm.addEventListener('submit', (ev) => {
    const submitter = ev.submitter;
    const intent = submitter ? submitter.value : 'ok';
    if (intent !== 'ok') return;
    if (!pendingProduct) {
      ev.preventDefault();
      return;
    }
    const error = validateOptions(pendingProduct);
    if (error) {
      ev.preventDefault();
      alert(error);
    }
  });

  // El evento `close` se dispara en <dialog>, no en el form.
  dialog.addEventListener('close', () => {
    const product = pendingProduct;
    const ok = dialog.returnValue === 'ok';
    pendingProduct = null;
    if (!ok || !product) return;
    const selected = collectSelectedOptionIds();
    addProduct(product, selected, (notesEl.value || '').trim());
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
    if (paymentEl.value === 'cash') {
      const total = Number(String(totalEl.textContent).replace('$', '')) || 0;
      const received = Number(receivedEl.value || 0);
      if (received < total) {
        ev.preventDefault();
        alert('El efectivo recibido es menor al total.');
        return;
      }
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
