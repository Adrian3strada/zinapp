(function () {
  const cfg = window.POS_REALTIME || {};
  const badge = document.getElementById('pos-live-badge');
  let socket = null;
  let pollTimer = null;
  let reconnectTimer = null;
  let intentionalClose = false;

  function setBadge(text, ok) {
    if (!badge) return;
    badge.textContent = text;
    badge.classList.toggle('is-live', !!ok);
    badge.classList.toggle('is-offline', !ok);
  }

  function wsUrl(ticket) {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const path = '/ws/v1/';
    return proto + '://' + window.location.host + path + '?ticket=' + encodeURIComponent(ticket);
  }

  async function fetchTicket() {
    const res = await fetch(cfg.ticketUrl, {
      method: 'POST',
      headers: {
        'X-CSRFToken': cfg.csrfToken,
        Accept: 'application/json',
      },
      credentials: 'same-origin',
    });
    if (!res.ok) throw new Error('ticket ' + res.status);
    return res.json();
  }

  function startPolling() {
    if (pollTimer) return;
    const seconds = Number(cfg.pollSeconds || 45);
    setBadge('Polling ' + seconds + 's', false);
    pollTimer = setInterval(function () {
      window.dispatchEvent(new CustomEvent('pos:orders-refresh'));
    }, seconds * 1000);
  }

  function stopPolling() {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(function () {
      reconnectTimer = null;
      connect();
    }, 5000);
  }

  async function connect() {
    if (!cfg.ticketUrl || !cfg.restaurantId) {
      startPolling();
      return;
    }
    try {
      const issued = await fetchTicket();
      intentionalClose = false;
      socket = new WebSocket(wsUrl(issued.ticket));
      socket.onopen = function () {
        stopPolling();
        setBadge('En vivo', true);
        socket.send(
          JSON.stringify({
            action: 'subscribe',
            restaurantId: Number(cfg.restaurantId),
          })
        );
      };
      socket.onmessage = function (ev) {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch (e) {
          return;
        }
        if (msg.type === 'restaurant.orders' || msg.type === 'order.updated') {
          window.dispatchEvent(
            new CustomEvent('pos:orders-refresh', { detail: msg.data || {} })
          );
        }
        if (msg.type === 'pong' || msg.type === 'subscribed') {
          setBadge('En vivo', true);
        }
      };
      socket.onclose = function () {
        setBadge('Reconectando…', false);
        startPolling();
        if (!intentionalClose) scheduleReconnect();
      };
      socket.onerror = function () {
        try {
          socket.close();
        } catch (e) {}
      };
      // keepalive
      setInterval(function () {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ action: 'ping' }));
        }
      }, 25000);
    } catch (e) {
      startPolling();
      scheduleReconnect();
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      window.dispatchEvent(new CustomEvent('pos:orders-refresh'));
    }
  });

  connect();
})();
