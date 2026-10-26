/* LinuxGuard NOC — cliente de las API REST y Socket.IO del backend.
 * NO inventa métricas. Si se pierde la conexión, indica datos desactualizados.
 * La URL del backend se configura en pantalla y se guarda solo en este navegador.
 */

// ----------------------------------------------------
// ESTADO DEL CLIENTE
// ----------------------------------------------------
const $ = id => document.getElementById(id);
const MAX_MEDICIONES = 20;
const historialCPU = [], historialRAM = [];
let apiBase = localStorage.getItem('linuxguardBackend') || 'http://localhost:3000';
let socket = null;
let ultimaRecepcion = 0;
let intervaloRespaldo = null;
let intervaloEventos = null;
let instanciaConexion = 0;

// Utilidades: convertimos datos con cuidado porque algunos sensores devuelven null.
const numero = valor => typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
const porcentaje = valor => numero(valor) === null ? null : Math.min(100, Math.max(0, valor));
const formato = (valor, decimales = 1) => numero(valor) === null ? '—' : valor.toFixed(decimales);
function texto(id, valor) { const elemento = $(id); if (elemento) elemento.textContent = String(valor); }

// ----------------------------------------------------
// CONEXIÓN Y CONSULTAS HTTP
// ----------------------------------------------------
function estadoConexion(conectado, mensaje = '') {
  const panel = $('panel-conexion');
  if (panel) panel.className = conectado ? 'conexion-activa' : 'conexion-inactiva';
  texto('texto-conexion', conectado ? 'CONECTADO' : 'DESCONECTADO');
  texto('descripcion-conexion', mensaje || (conectado ? 'Recibiendo métricas reales del backend.' : 'No llegan métricas del backend.'));
  const aviso = $('aviso-desconexion');
  if (aviso) aviso.hidden = conectado;
  if (!conectado) texto('tipo-datos', 'Sin conexión (datos anteriores)');
}

// Timeout para que las consultas no queden esperando indefinidamente.
async function obtenerJSON(ruta) {
  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), 10000);
  try {
    const respuesta = await fetch(apiBase + ruta, { signal: controlador.signal, cache: 'no-store' });
    if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);
    return await respuesta.json();
  } finally { clearTimeout(timeout); }
}

// ----------------------------------------------------
// BARRAS Y GRÁFICOS (CANVAS SIN DEPENDENCIAS EXTERNAS)
// ----------------------------------------------------
function barra(recurso, valor, estado) {
  const elemento = $('barra-' + recurso);
  if (!elemento) return;
  elemento.style.width = (porcentaje(valor) ?? 0) + '%';
  elemento.style.backgroundColor = estado === 'critico' ? '#ef4444' :
    estado === 'advertencia' ? '#f59e0b' : '#22c55e';
}
function guardarMedicion(historial, valor) {
  if (numero(valor) === null) return;
  historial.push(porcentaje(valor));
  if (historial.length > MAX_MEDICIONES) historial.shift();
}
function grafico(id, mediciones, color) {
  const canvas = $(id);
  const contexto = canvas?.getContext('2d');
  if (!contexto) return;
  const ancho = canvas.width, alto = canvas.height, margen = 35;
  contexto.clearRect(0, 0, ancho, alto);
  contexto.font = '12px Arial'; contexto.lineWidth = 1;
  for (let p = 0; p <= 100; p += 25) {
    const y = alto - margen - p / 100 * (alto - 2 * margen);
    contexto.strokeStyle = '#334155'; contexto.beginPath();
    contexto.moveTo(margen, y); contexto.lineTo(ancho - margen, y); contexto.stroke();
    contexto.fillStyle = '#94a3b8'; contexto.fillText(p + '%', 3, y + 4);
  }
  contexto.strokeStyle = color; contexto.lineWidth = 3; contexto.beginPath();
  mediciones.forEach((valor, indice) => {
    const x = margen + indice * (ancho - 2 * margen) / (MAX_MEDICIONES - 1);
    const y = alto - margen - valor / 100 * (alto - 2 * margen);
    if (indice === 0) contexto.moveTo(x, y); else contexto.lineTo(x, y);
  });
  contexto.stroke();
}

// ----------------------------------------------------
// ALERTAS, INFORMACIÓN Y TABLAS
// ----------------------------------------------------
function estadoGeneral(estado) {
  const descripciones = {
    normal: 'Los recursos están dentro de los límites configurados.',
    advertencia: 'Hay recursos en advertencia.',
    critico: 'Hay recursos en estado crítico.'
  };
  const panel = $('panel-estado');
  if (panel) panel.className = descripciones[estado] ? 'estado-' + estado : '';
  texto('texto-estado', descripciones[estado] ? estado.toUpperCase() : 'DESCONOCIDO');
  texto('descripcion-estado', descripciones[estado] || 'Sin estado válido.');
}
function alertasActivas(alertas) {
  const contenedor = $('lista-alertas');
  if (!contenedor) return;
  contenedor.replaceChildren();
  if (!Array.isArray(alertas) || !alertas.length) {
    const elemento = document.createElement('div');
    elemento.className = 'alerta alerta-normal';
    elemento.textContent = 'No hay alertas activas.';
    contenedor.appendChild(elemento);
    return;
  }
  for (const alerta of alertas) {
    const elemento = document.createElement('div');
    elemento.className = 'alerta ' + (alerta.nivel === 'critico' ? 'alerta-critica' : 'alerta-advertencia');
    elemento.textContent = alerta.mensaje || `${alerta.recurso}: ${alerta.nivel}`;
    contenedor.appendChild(elemento);
  }
}
// Crear celdas mediante textContent evita interpretar nombres externos como HTML.
function tabla(id, filas, cantidadColumnas, mensajeVacio) {
  const cuerpo = $(id);
  if (!cuerpo) return;
  cuerpo.replaceChildren();
  if (!filas.length) {
    const fila = document.createElement('tr'), celda = document.createElement('td');
    celda.colSpan = cantidadColumnas; celda.textContent = mensajeVacio;
    fila.appendChild(celda); cuerpo.appendChild(fila); return;
  }
  for (const valores of filas) {
    const fila = document.createElement('tr');
    for (const valor of valores) {
      const celda = document.createElement('td');
      celda.textContent = String(valor ?? '—'); fila.appendChild(celda);
    }
    cuerpo.appendChild(fila);
  }
}
function infoServidor(datos) {
  const sistema = datos.sistema || {};
  texto('nombre-servidor', sistema.hostname || '—');
  texto('sistema-operativo', [sistema.distribucion, sistema.version].filter(Boolean).join(' ') || sistema.plataforma || '—');
  texto('arquitectura-servidor', sistema.arquitectura || '—');
  const interfaces = Array.isArray(datos.red?.interfaces) ? datos.red.interfaces : [];
  const ip = interfaces.find(i => i.ip4 && !i.ip4.startsWith('127.') && i.ip4 !== '0.0.0.0')?.ip4;
  texto('ip-servidor', ip || '—');
  const segundos = numero(datos.uptime);
  texto('uptime-servidor', segundos === null ? '—' :
    `${Math.floor(segundos / 86400)} d, ${Math.floor(segundos % 86400 / 3600)} h, ${Math.floor(segundos % 3600 / 60)} min`);
  texto('tipo-datos', 'Reales (API / Socket.IO)');
}

// ----------------------------------------------------
// TRANSFORMAR EL JSON DEL BACKEND EN VALORES VISUALES
// ----------------------------------------------------
function procesarMetricas(datos) {
  if (!datos || typeof datos !== 'object' || !datos.cpu || !datos.memoria) return;
  const cpu = porcentaje(datos.cpu.usoPorcentaje);
  const ram = porcentaje(numero(datos.memoria.usoPorcentaje) ??
    (numero(datos.memoria.total) > 0 ? datos.memoria.usada / datos.memoria.total * 100 : null));
  const discos = Array.isArray(datos.discos) ? datos.discos : [];
  const discoPrincipal = discos.filter(d => porcentaje(d.usoPorcentaje) !== null)
    .sort((a, b) => b.usoPorcentaje - a.usoPorcentaje)[0];
  const disco = discoPrincipal ? porcentaje(discoPrincipal.usoPorcentaje) : null;
  texto('cpu', formato(cpu)); texto('ram', formato(ram)); texto('disco', formato(disco));
  texto('temperatura-cpu', formato(numero(datos.cpu.temperatura)));
  barra('cpu', cpu, datos.cpu.estado);
  barra('ram', ram, datos.memoria.estado);
  barra('disco', disco, discoPrincipal?.estado);
  // rx_sec y tx_sec vienen en bytes por segundo: 8 bits por byte / 1.000.000.
  const interfacesActivas = new Set((datos.red?.interfaces || [])
    .filter(i => i.estado === 'up' && i.nombre !== 'lo' && i.nombre !== 'lo0')
    .map(i => i.nombre));
  const trafico = (datos.red?.trafico || []).filter(i => interfacesActivas.has(i.nombre));
  const rx = trafico.reduce((total, i) => total + (numero(i.recibidosPorSegundo) || 0), 0);
  const tx = trafico.reduce((total, i) => total + (numero(i.enviadosPorSegundo) || 0), 0);
  texto('red-entrada', trafico.length ? formato(rx * 8 / 1e6, 3) : '—');
  texto('red-salida', trafico.length ? formato(tx * 8 / 1e6, 3) : '—');
  guardarMedicion(historialCPU, cpu); guardarMedicion(historialRAM, ram);
  grafico('grafico-cpu', historialCPU, '#38bdf8');
  grafico('grafico-ram', historialRAM, '#22c55e');
  estadoGeneral(datos.estadoGeneral);
  alertasActivas(datos.alertas);
  infoServidor(datos);
  tabla('tabla-procesos', (datos.procesos || []).map(p =>
    [p.pid, p.nombre, formato(numero(p.cpuPorcentaje), 2), formato(numero(p.memoriaPorcentaje), 2), p.estado]),
    5, 'No hay procesos disponibles.');
  tabla('tabla-servicios', (datos.servicios || []).map(s => [s.nombre, s.estado]),
    2, 'No hay servicios disponibles.');
  ultimaRecepcion = Date.now();
  texto('hora-actualizacion', new Date().toLocaleString('es-AR'));
  estadoConexion(true);
}

// ----------------------------------------------------
// API REST: respaldo de métricas e historial persistente
// ----------------------------------------------------
async function consultarSistema() {
  try {
    const datos = await obtenerJSON('/api/sistema');
    procesarMetricas(datos);
  } catch (error) {
    if (Date.now() - ultimaRecepcion > 10000) estadoConexion(false, 'No se pudo consultar /api/sistema.');
    console.warn('Consulta de sistema:', error.message);
  }
}
async function consultarEventos() {
  try {
    const eventos = await obtenerJSON('/api/eventos');
    if (!Array.isArray(eventos)) return;
    tabla('tabla-historial', eventos.slice(-100).reverse().map(ev => {
      const fecha = ev.fecha ? new Date(ev.fecha) : null;
      return [fecha && !Number.isNaN(fecha.getTime()) ? fecha.toLocaleString('es-AR') : '—',
        ev.recurso, ev.mensaje, ev.nivel];
    }), 4, 'Sin eventos registrados en el backend.');
  } catch (error) { console.warn('Consulta de eventos:', error.message); }
}
async function consultarUmbrales() {
  try {
    const umbrales = await obtenerJSON('/api/config/umbrales');
    for (const recurso of ['cpu', 'memoria', 'temperatura', 'disco']) {
      for (const nivel of ['advertencia', 'critico']) {
        const campo = $(`${recurso}-${nivel}`);
        if (campo && umbrales[recurso]) campo.value = umbrales[recurso][nivel];
      }
    }
    texto('mensaje-configuracion', 'Umbrales cargados desde el backend.');
  } catch (error) { texto('mensaje-configuracion', 'No se pudieron leer los umbrales.'); }
}

// ----------------------------------------------------
// PUT: guardar los cuatro recursos con validación previa
// ----------------------------------------------------
async function guardarUmbrales(evento) {
  evento.preventDefault();
  const nuevos = {};
  for (const recurso of ['cpu', 'memoria', 'temperatura', 'disco']) {
    const advertencia = Number($(`${recurso}-advertencia`).value);
    const critico = Number($(`${recurso}-critico`).value);
    const maximo = recurso === 'temperatura' ? 120 : 100;
    if (!Number.isFinite(advertencia) || !Number.isFinite(critico) ||
        advertencia < 0 || critico > maximo || critico <= advertencia) {
      texto('mensaje-configuracion', `Valores inválidos en ${recurso}: crítico debe ser mayor a advertencia.`);
      return;
    }
    nuevos[recurso] = { advertencia, critico };
  }
  try {
    const respuesta = await fetch(apiBase + '/api/config/umbrales', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nuevos)
    });
    if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);
    texto('mensaje-configuracion', 'Umbrales guardados correctamente en el backend.');
    consultarSistema();
  } catch (error) { texto('mensaje-configuracion', `No se pudieron guardar los umbrales: ${error.message}`); }
}

// ----------------------------------------------------
// SOCKET.IO: cliente cargado desde el servidor elegido
// ----------------------------------------------------
function cargarSocketIO(generacion) {
  // Socket.IO sirve su librería de cliente por esta ruta.
  const etiqueta = document.createElement('script');
  etiqueta.src = apiBase + '/socket.io/socket.io.js';
  etiqueta.onload = () => {
    if (generacion !== instanciaConexion) return;
    if (typeof window.io !== 'function') return;
    socket = window.io(apiBase, { reconnection: true, timeout: 10000 });
    socket.on('connect', () => consultarSistema());
    socket.on('metricas', datos => {
      procesarMetricas(datos);
      if (Date.now() % 10000 < 2100) consultarEventos();
    });
    socket.on('disconnect', () => estadoConexion(false, 'Socket.IO desconectado: verificando alternativa HTTP.'));
    socket.on('connect_error', error => console.warn('Socket.IO:', error.message));
  };
  etiqueta.onerror = () => console.warn('No se pudo cargar Socket.IO; se utilizará la API REST.');
  document.head.appendChild(etiqueta);
}
function conectar() {
  instanciaConexion += 1;
  const generacion = instanciaConexion;
  if (socket) { socket.disconnect(); socket = null; }
  if (intervaloRespaldo) clearInterval(intervaloRespaldo);
  if (intervaloEventos) clearInterval(intervaloEventos);
  ultimaRecepcion = 0;
  historialCPU.length = 0; historialRAM.length = 0;
  estadoConexion(false, 'Conectando a ' + apiBase + ' ...');
  consultarSistema(); consultarEventos(); consultarUmbrales();
  cargarSocketIO(generacion);
  // Cuando Socket.IO está enviando datos, evitamos consultas REST innecesarias.
  intervaloRespaldo = setInterval(() => {
    if (!socket?.connected || Date.now() - ultimaRecepcion > 7000) consultarSistema();
    if (ultimaRecepcion && Date.now() - ultimaRecepcion > 15000) estadoConexion(false, 'Sin datos recientes del backend.');
  }, 5000);
  intervaloEventos = setInterval(consultarEventos, 15000);
}

// ----------------------------------------------------
// INICIO: los eventos se registran cuando existe el HTML
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  $('input-ip-servidor').value = apiBase;
  $('form-servidor').addEventListener('submit', evento => {
    evento.preventDefault();
    const valor = $('input-ip-servidor').value.trim().replace(/\/+$/, '');
    try {
      const url = new URL(valor);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
          url.pathname !== '/' || url.search || url.hash) throw new Error('URL inválida');
      apiBase = url.origin;
      localStorage.setItem('linuxguardBackend', apiBase);
      texto('mensaje-servidor', 'Dirección guardada: ' + apiBase);
      conectar();
    } catch (_) { texto('mensaje-servidor', 'Usá una URL válida, por ejemplo http://localhost:3000'); }
  });
  $('form-configuracion').addEventListener('submit', guardarUmbrales);
  conectar();
});
