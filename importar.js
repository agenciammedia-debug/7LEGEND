// =====================================================================
// 7LEGEND · Importar servicios (Excel, CSV, Google Sheets o texto pegado)
// Detecta solo las columnas: servicio, precio, categoría y comisión.
// =====================================================================
(function () {
  const normalizar = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

  function numero(v) {
    let t = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
    if (!/\d/.test(t)) return NaN;
    if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    t = t.replace(/,(?=\d{3}\b)/g, '').replace(',', '.');
    const n = Number(t); return isFinite(n) ? n : NaN;
  }

  function parsear(txt) {
    txt = String(txt || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const primera = txt.split('\n').find(l => l.trim()) || '';
    const sep = primera.indexOf('\t') !== -1 ? '\t' : (primera.split(';').length > primera.split(',').length ? ';' : ',');
    const filas = []; let fila = [], celda = '', comillas = false;
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      if (comillas) {
        if (ch === '"' && txt[i + 1] === '"') { celda += '"'; i++; }
        else if (ch === '"') comillas = false;
        else celda += ch;
      } else if (ch === '"' && celda === '') comillas = true;
      else if (ch === sep) { fila.push(celda); celda = ''; }
      else if (ch === '\n') { fila.push(celda); filas.push(fila); fila = []; celda = ''; }
      else celda += ch;
    }
    if (celda !== '' || fila.length) { fila.push(celda); filas.push(fila); }
    return filas;
  }

  let cargandoXLSX = null;
  function cargarXLSX() {
    if (window.XLSX) return Promise.resolve();
    if (!cargandoXLSX) cargandoXLSX = new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = ok; s.onerror = () => { cargandoXLSX = null; mal(new Error('No se pudo cargar el lector de Excel. Revisa tu conexión.')); };
      document.head.appendChild(s);
    });
    return cargandoXLSX;
  }

  async function leerArchivo(f) {
    if (/\.(csv|tsv|txt)$/i.test(f.name)) return parsear(await f.text());
    await cargarXLSX();
    const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
    const hoja = wb.SheetNames.map(n => wb.Sheets[n]).find(h => XLSX.utils.sheet_to_json(h, { header: 1, blankrows: false }).length) || wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: '', blankrows: false });
  }

  const PISTAS = {
    cat: /^(categoria|categ|tipo|grupo|seccion|familia|rubro|area)$/,
    nom: /(servicio|nombre|producto|descripcion|detalle|tratamiento|item|concepto)/,
    pre: /(precio|monto|costo|valor|tarifa|importe|s\/)/,
    com: /(comision|com\.?$|%)/
  };
  const esNumero = v => String(v).trim() !== '' && isFinite(numero(v));

  function detectar(filas) {
    for (let f = 0; f < Math.min(8, filas.length); f++) {
      const mapa = filas[f].map(c => {
        c = normalizar(c); if (!c) return '';
        for (const r of ['com', 'pre', 'cat', 'nom']) if (PISTAS[r].test(c)) return r;
        return '';
      });
      if (mapa.includes('nom') && (mapa.includes('pre') || mapa.includes('cat'))) {
        const vistos = {}; mapa.forEach((r, i) => { if (r && vistos[r]) mapa[i] = ''; vistos[r] = 1; });
        return { cab: f, mapa };
      }
    }
    const n = Math.max(...filas.slice(0, 30).map(r => r.length));
    const cols = Array.from({ length: n }, (_, i) => filas.slice(0, 40).map(r => r[i] == null ? '' : String(r[i]).trim()).filter(Boolean));
    const mapa = Array(n).fill('');
    const nums = cols.map((c, i) => [i, c.length ? c.filter(esNumero).length / c.length : 0]).filter(x => x[1] > .6).map(x => x[0]);
    if (nums.length) mapa[nums[0]] = 'pre';
    if (nums.length > 1) mapa[nums[1]] = 'com';
    const txt = cols.map((c, i) => [i, c.length, new Set(c).size]).filter(x => mapa[x[0]] === '' && x[1]).sort((a, b) => b[2] - a[2]);
    if (txt[0]) mapa[txt[0][0]] = 'nom';
    if (txt[1] && txt[1][2] < txt[0][2]) mapa[txt[1][0]] = 'cat';
    return { cab: -1, mapa };
  }

  // filas → [{categoria, nombre, precio, libre?, comTipo?, comValor?}] + errores
  function aServicios(filas) {
    filas = (filas || []).map(r => (r || []).map(c => c == null ? '' : String(c).trim())).filter(r => r.some(Boolean));
    if (!filas.length) return { items: [], errores: ['No encontramos datos.'] };
    const { cab, mapa } = detectar(filas), idx = r => mapa.indexOf(r);
    const iN = idx('nom'), iP = idx('pre'), iC = idx('cat'), iM = idx('com');
    if (iN < 0) return { items: [], errores: ['No encontramos la columna de servicios.'] };
    const items = [], errores = [], vistos = {};
    let catActual = 'General';
    filas.slice(cab + 1).forEach((r, k) => {
      const nom = r[iN] || '', preT = iP >= 0 ? (r[iP] || '') : '', catT = iC >= 0 ? (r[iC] || '') : '';
      if (nom && !preT && iC < 0 && r.filter(Boolean).length === 1 && iP >= 0) { catActual = nom.slice(0, 30); return; }
      if (!nom) { if (catT) catActual = catT.slice(0, 30); return; }
      if (catT) catActual = catT.slice(0, 30);
      const it = { categoria: catActual, nombre: nom.replace(/,/g, ' ').replace(/\s+/g, ' ').slice(0, 60), precio: 0 };
      if (/libre|variable|desde|consultar|cotizar|evaluar/i.test(preT) || (iP >= 0 && !preT)) it.libre = true;
      else { const p = numero(preT); if (!(p >= 0)) { errores.push('Fila ' + (k + cab + 2) + ': precio no válido (“' + preT + '”)'); return; } it.precio = Math.round(p * 100) / 100; }
      if (iM >= 0 && r[iM]) {
        const t = r[iM], v = numero(t);
        if (v >= 0) {
          if (/s\/|soles|fij|\$|€|£/i.test(t) || (!/%/.test(t) && v > 100)) { it.comTipo = 'S/'; it.comValor = v; }
          else { it.comTipo = '%'; it.comValor = v <= 1 && /\./.test(t) && !/%/.test(t) ? Math.round(v * 1000) / 10 : v; }
        }
      }
      const k2 = normalizar(it.nombre);
      if (vistos[k2] != null) items[vistos[k2]] = it; else { vistos[k2] = items.length; items.push(it); }
    });
    return { items, errores };
  }

  async function plantilla() {
    await cargarXLSX();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['Categoría', 'Servicio', 'Precio', 'Comisión'], ['Manos', 'Manicure clásica', 25, ''], ['Manos', 'Manicure gel', 50, '40%'],
      ['Pies', 'Pedicure spa', 60, ''], ['Masajes', 'Relajante 60 min', 120, 'S/ 30'], ['Masajes', 'Paquete especial', 'Libre', '']]);
    ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 10 }, { wch: 11 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Servicios');
    XLSX.writeFile(wb, 'Plantilla servicios 7LEGEND.xlsx');
  }

  window.Importar = { parsear, leerArchivo, aServicios, plantilla, numero };
})();
