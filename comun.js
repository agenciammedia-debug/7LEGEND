// 7LEGEND · utilidades compartidas por la landing y las apps
(function () {
  const L = window.LEGEND || {};

  // Llamada al backend (Apps Script). Lanza Error con .code: AUTH, VENCIDO, ESPERA, RED, etc.
  window.api = async function (action, data, token, timeoutMs) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs || 30000);
    try {
      const r = await fetch(L.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: action, data: data || {}, token: token || '' }),
        signal: ctrl.signal
      });
      const j = await r.json();
      if (!j.ok) { const e = new Error(j.error || 'Ocurrió un error'); e.code = j.code || 'SERVIDOR'; throw e; }
      return j.data;
    } catch (e) {
      if (e.name === 'AbortError') { const x = new Error('El servidor tardó demasiado. Revisa tu conexión e intenta de nuevo.'); x.code = 'RED'; throw x; }
      if (!e.code) { const x = new Error('Sin conexión. Revisa tu internet e intenta de nuevo.'); x.code = 'RED'; throw x; }
      throw e;
    } finally { clearTimeout(t); }
  };

  window.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  // Monedas: código → [símbolo, nombre, decimales]
  window.MONEDAS = {
    PEN: ['S/', 'Sol peruano', 2], USD: ['US$', 'Dólar estadounidense', 2], EUR: ['€', 'Euro', 2], MXN: ['MX$', 'Peso mexicano', 2],
    COP: ['COL$', 'Peso colombiano', 0], CLP: ['CLP$', 'Peso chileno', 0], ARS: ['AR$', 'Peso argentino', 2], BOB: ['Bs', 'Boliviano', 2],
    BRL: ['R$', 'Real brasileño', 2], GTQ: ['Q', 'Quetzal', 2], CRC: ['₡', 'Colón costarricense', 0], DOP: ['RD$', 'Peso dominicano', 2],
    UYU: ['$U', 'Peso uruguayo', 2], PYG: ['₲', 'Guaraní', 0], HNL: ['L', 'Lempira', 2], NIO: ['C$', 'Córdoba', 2],
    PAB: ['B/.', 'Balboa', 2], VES: ['Bs.', 'Bolívar', 2], CAD: ['CA$', 'Dólar canadiense', 2], GBP: ['£', 'Libra esterlina', 2]
  };
  window.MONEDA = 'PEN';
  window.fijarMoneda = function (c) { window.MONEDA = window.MONEDAS[c] ? c : 'PEN'; };
  window.simbolo = function (c) { return (window.MONEDAS[c || window.MONEDA] || window.MONEDAS.PEN)[0]; };
  window.dinero = function (n, c) {
    const m = window.MONEDAS[c || window.MONEDA] || window.MONEDAS.PEN;
    const v = Math.round((Number(n) || 0) * 100) / 100;
    const ent = Number.isInteger(v) || m[2] === 0;
    return m[0] + ' ' + v.toLocaleString('en-US', { minimumFractionDigits: ent ? 0 : 2, maximumFractionDigits: ent ? 0 : 2 });
  };
  window.soles = function (n) { return window.dinero(n); };   // nombre histórico: usa la moneda del negocio

  window.norm = function (x) {
    return String(x == null ? '' : x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  };

  window.guardarLocal = function (k, v) { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); return true; } catch (e) { return false; } };
  window.leerLocal = function (k, json) {
    try { const v = localStorage.getItem(k); return json ? (v ? JSON.parse(v) : null) : v; } catch (e) { return null; }
  };
  window.borrarLocal = function (k) { try { localStorage.removeItem(k); } catch (e) {} };

  window.esIOS = function () { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); };
  window.esStandalone = function () { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; };

  window.copiar = async function (texto) {
    try { await navigator.clipboard.writeText(texto); return true; } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = texto; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (x) {}
      document.body.removeChild(ta);
      return ok;
    }
  };

  window.toast = function (msg, ms) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.style.cssText = 'position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%) translateY(20px);' +
        'background:rgba(29,29,31,.92);color:#fff;padding:12px 18px;border-radius:14px;font-size:14px;font-weight:500;z-index:9999;' +
        'opacity:0;transition:all .3s ease;max-width:88vw;text-align:center;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);pointer-events:none;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateX(-50%) translateY(0)'; });
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(-50%) translateY(20px)'; }, ms || 2600);
  };

  // Guía de instalación (iPhone / Android) reutilizable
  let promptInstalacion = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptInstalacion = e; document.dispatchEvent(new Event('instalable')); });
  window.puedeInstalarDirecto = function () { return !!promptInstalacion; };
  window.instalarDirecto = async function () {
    if (!promptInstalacion) return false;
    promptInstalacion.prompt();
    const r = await promptInstalacion.userChoice;
    promptInstalacion = null;
    return r && r.outcome === 'accepted';
  };
  window.htmlGuiaInstalar = function () {
    const ios = esIOS();
    const pasosIOS = '<ol class="guia"><li>Abre este link en <b>Safari</b>.</li><li>Toca <b>Compartir</b> <span class="ico-share">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>' +
      '</span> abajo.</li><li>Elige <b>Agregar a inicio</b> y toca <b>Agregar</b>.</li></ol>';
    const pasosAndroid = '<ol class="guia"><li>Abre este link en <b>Chrome</b>.</li><li>Toca el menú <b>⋮</b> arriba a la derecha.</li><li>Elige <b>Instalar app</b> o <b>Agregar a pantalla principal</b>.</li></ol>';
    return '<div class="tabs-guia"><button class="' + (ios ? 'on' : '') + '" data-g="ios">iPhone</button><button class="' + (ios ? '' : 'on') + '" data-g="and">Android</button></div>' +
      '<div class="guia-ios" ' + (ios ? '' : 'hidden') + '>' + pasosIOS + '</div><div class="guia-and" ' + (ios ? 'hidden' : '') + '>' + pasosAndroid + '</div>';
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('.tabs-guia button');
    if (!b) return;
    const caja = b.closest('.tabs-guia').parentElement;
    caja.querySelectorAll('.tabs-guia button').forEach(x => x.classList.toggle('on', x === b));
    caja.querySelector('.guia-ios').hidden = b.dataset.g !== 'ios';
    caja.querySelector('.guia-and').hidden = b.dataset.g !== 'and';
  });
})();
