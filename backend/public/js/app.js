/*
 * ============================================================
 * LinuxGuard NOC
 * Cliente frontend del sistema de monitoreo GNU/Linux.
 * ============================================================
 *
 * Este archivo se ejecuta únicamente en el navegador.
 *
 * Responsabilidades principales:
 *
 * - Conectarse al backend LinuxGuard.
 * - Consultar la API REST.
 * - Recibir métricas en tiempo real mediante Socket.IO.
 * - Actualizar CPU, RAM, disco, temperatura y red.
 * - Actualizar los gauges del dashboard.
 * - Mostrar información del servidor.
 * - Mostrar procesos y servicios.
 * - Dibujar el gráfico combinado CPU / RAM.
 * - Mostrar alertas e historial.
 * - Consultar y modificar umbrales.
 *
 * IMPORTANTE:
 *
 * No existen métricas simuladas.
 * Todos los valores proceden del backend.
 */


// ============================================================
// UTILIDAD PARA BUSCAR ELEMENTOS HTML
// ============================================================

const $ = id =>
  document.getElementById(id);


// Cantidad máxima de puntos que conservamos
// en el gráfico de CPU y RAM.
const MAX_MEDICIONES = 20;


// Historial temporal utilizado por el gráfico.
const historialCPU = [];
const historialRAM = [];


// ============================================================
// DIRECCIÓN DEL BACKEND
// ============================================================

/*
 * El frontend normalmente es servido por el MISMO Express
 * que contiene las APIs.
 *
 * Ejemplo en casa:
 *
 * http://192.168.0.66:3000
 *
 * Ejemplo en otra red:
 *
 * http://10.0.2.15:3000
 *
 * window.location.origin obtiene automáticamente:
 *
 * protocolo + IP/hostname + puerto
 *
 * De esta forma NO dejamos una IP fija en el código.
 */

const origenActual =
  (
    window.location.protocol === "http:" ||
    window.location.protocol === "https:"
  )
    ? window.location.origin
    : "http://localhost:3000";


/*
 * El usuario también puede configurar manualmente otro backend.
 *
 * Esto es útil principalmente:
 *
 * - para pruebas;
 * - para el futuro APK;
 * - si frontend y backend se ejecutan separados.
 */
let backendGuardado =
  localStorage.getItem(
    "linuxguardBackend"
  );


/*
 * CORRECCIÓN DE CONFIGURACIONES ANTIGUAS
 *
 * Antes el proyecto utilizaba localhost:3000 por defecto.
 *
 * Si ahora abrimos LinuxGuard mediante:
 *
 * http://192.168.x.x:3000
 *
 * pero quedó guardado:
 *
 * http://localhost:3000
 *
 * ese localhost pertenece a una configuración vieja.
 *
 * Lo descartamos para utilizar automáticamente
 * el origen real desde donde se abrió LinuxGuard.
 */
try {

  if (backendGuardado) {

    const guardado =
      new URL(backendGuardado);

    const actual =
      new URL(origenActual);


    const guardadoEsLocal =
      guardado.hostname === "localhost" ||
      guardado.hostname === "127.0.0.1";


    const paginaNoEsLocal =
      actual.hostname !== "localhost" &&
      actual.hostname !== "127.0.0.1";


    if (
      guardadoEsLocal &&
      paginaNoEsLocal
    ) {

      localStorage.removeItem(
        "linuxguardBackend"
      );

      backendGuardado = null;
    }
  }

} catch (error) {

  /*
   * Si había una URL inválida guardada,
   * simplemente la eliminamos.
   */
  localStorage.removeItem(
    "linuxguardBackend"
  );

  backendGuardado = null;
}


/*
 * Prioridad:
 *
 * 1. backend configurado manualmente;
 * 2. mismo servidor desde donde se abrió la web.
 */
let apiBase =
  backendGuardado ||
  origenActual;


// ============================================================
// VARIABLES DE CONEXIÓN
// ============================================================

// Conexión Socket.IO activa.
let socket = null;


// Momento de la última métrica recibida.
let ultimaRecepcion = 0;


// Intervalo REST utilizado como respaldo.
let intervaloRespaldo = null;


// Intervalo para actualizar eventos.
let intervaloEventos = null;


/*
 * Cada vez que cambiamos de backend incrementamos este número.
 *
 * Sirve para evitar que una conexión Socket.IO anterior
 * interfiera con una nueva.
 */
let instanciaConexion = 0;


// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

/*
 * Devuelve un número válido o null.
 */
const numero = valor => {

  const convertido =
    Number(valor);

  return Number.isFinite(convertido)
    ? convertido
    : null;
};


/*
 * Limita un porcentaje entre 0 y 100.
 */
const porcentaje = valor => {

  const n =
    numero(valor);

  if (n === null) {
    return null;
  }

  return Math.min(
    100,
    Math.max(0, n)
  );
};


/*
 * Formatea números.
 *
 * Si no existe un valor válido mostramos "—".
 */
const formato = (
  valor,
  decimales = 1
) => {

  const n =
    numero(valor);

  if (n === null) {
    return "—";
  }

  return n.toFixed(decimales);
};


/*
 * Formatea fecha y hora utilizando reloj de 24 horas.
 *
 * Ejemplo:
 *
 * 26/10/2026, 22:23:15
 *
 * Esto evita que el navegador muestre las 22:23
 * como 10:23 sin indicar claramente AM/PM.
 */
function formatoFechaHora(fecha) {

  if (
    !(fecha instanceof Date) ||
    Number.isNaN(
      fecha.getTime()
    )
  ) {

    return "—";
  }


  return fecha.toLocaleString(
    "es-AR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",

      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",

      hour12: false
    }
  );
}


/*
 * Cambia de forma segura el texto de un elemento.
 *
 * Si el elemento no existe, no genera error.
 */
function texto(
  id,
  valor
) {

  const elemento =
    $(id);

  if (elemento) {

    elemento.textContent =
      String(valor);
  }
}


// ============================================================
// ESTADO DE CONEXIÓN
// ============================================================

function estadoConexion(
  conectado,
  mensaje = ""
) {

  const panel =
    $("panel-conexion");


  /*
   * Conservamos la clase top-status necesaria
   * para el diseño nuevo.
   */
  if (panel) {

    panel.className =
      conectado
        ? "top-status conexion-activa"
        : "top-status conexion-inactiva";
  }


  texto(
    "texto-conexion",
    conectado
      ? "CONECTADO"
      : "DESCONECTADO"
  );


  texto(
    "descripcion-conexion",

    mensaje ||

    (
      conectado
        ? "Recibiendo métricas reales del backend."
        : "No llegan métricas del backend."
    )
  );


  // Estado mostrado también en la barra lateral.
  texto(
    "sidebar-estado",
    conectado
      ? "Conectado"
      : "Desconectado"
  );


  /*
   * Mostramos solamente hostname/IP + puerto
   * en la tarjeta inferior de la barra lateral.
   */
  try {

    const url =
      new URL(apiBase);

    texto(
      "sidebar-servidor",
      url.host
    );

  } catch {

    texto(
      "sidebar-servidor",
      apiBase
    );
  }


  const aviso =
    $("aviso-desconexion");


  if (aviso) {

    aviso.hidden =
      conectado;
  }


  if (!conectado) {

    texto(
      "tipo-datos",
      "Sin conexión"
    );
  }
}


// ============================================================
// CONSULTAS REST
// ============================================================

/*
 * Realiza una consulta GET al backend.
 *
 * La petición se cancela si tarda más de 10 segundos.
 */
async function obtenerJSON(ruta) {

  const controlador =
    new AbortController();


  const timeout =
    setTimeout(
      () => controlador.abort(),
      10000
    );


  try {

    const respuesta =
      await fetch(
        apiBase + ruta,
        {
          signal:
            controlador.signal,

          cache:
            "no-store"
        }
      );


    if (!respuesta.ok) {

      throw new Error(
        `HTTP ${respuesta.status}`
      );
    }


    return await respuesta.json();


  } finally {

    clearTimeout(timeout);
  }
}


// ============================================================
// GAUGES
// ============================================================

/*
 * Los medidores circulares están construidos con CSS.
 *
 * JavaScript únicamente modifica la variable:
 *
 * --angulo
 *
 * El máximo visual es 180 grados.
 */
function actualizarGauge(
  id,
  valor,
  maximo = 100
) {

  const gauge =
    $(id);


  if (!gauge) {
    return;
  }


  const n =
    numero(valor);


  if (
    n === null ||
    maximo <= 0
  ) {

    gauge.style.setProperty(
      "--angulo",
      "0deg"
    );

    return;
  }


  const valorLimitado =
    Math.min(
      maximo,
      Math.max(0, n)
    );


  const angulo =
    (
      valorLimitado /
      maximo
    ) * 180;


  gauge.style.setProperty(
    "--angulo",
    `${angulo}deg`
  );
}


// ============================================================
// HISTORIAL DEL GRÁFICO
// ============================================================

function guardarMedicion(
  historial,
  valor
) {

  const n =
    porcentaje(valor);


  if (n === null) {
    return;
  }


  historial.push(n);


  if (
    historial.length >
    MAX_MEDICIONES
  ) {

    historial.shift();
  }
}


// ============================================================
// GRÁFICO CPU + RAM
// ============================================================

/*
 * El diseño nuevo utiliza un gráfico combinado,
 * similar a un dashboard NOC / Grafana.
 *
 * CPU = naranja
 * RAM = azul
 *
 * Las dos series se dibujan sobre grafico-cpu.
 */
function dibujarGraficoRecursos() {

  const canvas =
    $("grafico-cpu");


  const contexto =
    canvas?.getContext("2d");


  if (!contexto) {
    return;
  }


  /*
   * Ajustamos el tamaño interno del canvas
   * al tamaño visible para que se vea nítido.
   */
  const rect =
    canvas.getBoundingClientRect();


  if (
    rect.width > 0 &&
    rect.height > 0
  ) {

    canvas.width =
      Math.round(rect.width);

    canvas.height =
      Math.round(rect.height);
  }


  const ancho =
    canvas.width;

  const alto =
    canvas.height;


  const margenIzquierdo = 45;
  const margenDerecho = 15;
  const margenSuperior = 12;
  const margenInferior = 25;


  contexto.clearRect(
    0,
    0,
    ancho,
    alto
  );


  // ----------------------------------------------------------
  // GRILLA
  // ----------------------------------------------------------

  contexto.font =
    "11px Arial";


  for (
    let p = 0;
    p <= 100;
    p += 25
  ) {

    const alturaUtil =
      alto -
      margenSuperior -
      margenInferior;


    const y =
      alto -
      margenInferior -
      (
        p /
        100
      ) *
      alturaUtil;


    contexto.strokeStyle =
      "#27323c";

    contexto.lineWidth = 1;

    contexto.beginPath();

    contexto.moveTo(
      margenIzquierdo,
      y
    );

    contexto.lineTo(
      ancho -
      margenDerecho,
      y
    );

    contexto.stroke();


    contexto.fillStyle =
      "#7f8c98";

    contexto.fillText(
      `${p}%`,
      5,
      y + 4
    );
  }


  // ----------------------------------------------------------
  // DIBUJAR UNA SERIE
  // ----------------------------------------------------------

  function dibujarSerie(
    mediciones,
    color
  ) {

    if (!mediciones.length) {
      return;
    }


    const anchoUtil =
      ancho -
      margenIzquierdo -
      margenDerecho;


    const altoUtil =
      alto -
      margenSuperior -
      margenInferior;


    contexto.strokeStyle =
      color;

    contexto.lineWidth =
      2;

    contexto.lineJoin =
      "round";

    contexto.lineCap =
      "round";

    contexto.beginPath();


    mediciones.forEach(
      (
        valor,
        indice
      ) => {

        const x =
          margenIzquierdo +
          (
            indice /
            Math.max(
              MAX_MEDICIONES - 1,
              1
            )
          ) *
          anchoUtil;


        const y =
          alto -
          margenInferior -
          (
            valor /
            100
          ) *
          altoUtil;


        if (indice === 0) {

          contexto.moveTo(
            x,
            y
          );

        } else {

          contexto.lineTo(
            x,
            y
          );
        }
      }
    );


    contexto.stroke();
  }


  // CPU: color principal estilo Grafana.
  dibujarSerie(
    historialCPU,
    "#ff8700"
  );


  // RAM.
  dibujarSerie(
    historialRAM,
    "#2495e6"
  );
}


// ============================================================
// ESTADO GENERAL DEL SERVIDOR
// ============================================================

function estadoGeneral(estado) {

  const descripciones = {

    normal:
      "Todos los recursos están dentro de los umbrales.",

    advertencia:
      "Hay recursos en estado de advertencia.",

    critico:
      "Hay recursos en estado crítico."
  };


  const panel =
    $("panel-estado");


  if (panel) {

    panel.className =
      descripciones[estado]
        ? `estado-box estado-${estado}`
        : "estado-box";
  }


  texto(
    "texto-estado",

    descripciones[estado]
      ? estado.toUpperCase()
      : "DESCONOCIDO"
  );


  texto(
    "descripcion-estado",

    descripciones[estado] ||
    "Sin estado válido."
  );
}


// ============================================================
// ALERTAS ACTIVAS
// ============================================================

function alertasActivas(alertas) {

  const contenedor =
    $("lista-alertas");


  if (!contenedor) {
    return;
  }


  contenedor.replaceChildren();


  if (
    !Array.isArray(alertas) ||
    alertas.length === 0
  ) {

    const elemento =
      document.createElement(
        "div"
      );


    elemento.className =
      "alerta alerta-normal";


    elemento.textContent =
      "No hay alertas activas.";


    contenedor.appendChild(
      elemento
    );


    return;
  }


  for (
    const alerta of alertas
  ) {

    const elemento =
      document.createElement(
        "div"
      );


    elemento.className =
      alerta.nivel === "critico"
        ? "alerta alerta-critica"
        : "alerta alerta-advertencia";


    elemento.textContent =
      alerta.mensaje ||
      `${alerta.recurso}: ${alerta.nivel}`;


    contenedor.appendChild(
      elemento
    );
  }
}


// ============================================================
// GENERADOR DE TABLAS
// ============================================================

function tabla(
  id,
  filas,
  cantidadColumnas,
  mensajeVacio
) {

  const cuerpo =
    $(id);


  if (!cuerpo) {
    return;
  }


  cuerpo.replaceChildren();


  if (
    !Array.isArray(filas) ||
    filas.length === 0
  ) {

    const fila =
      document.createElement(
        "tr"
      );


    const celda =
      document.createElement(
        "td"
      );


    celda.colSpan =
      cantidadColumnas;


    celda.textContent =
      mensajeVacio;


    fila.appendChild(
      celda
    );


    cuerpo.appendChild(
      fila
    );


    return;
  }


  for (
    const valores of filas
  ) {

    const fila =
      document.createElement(
        "tr"
      );


    for (
      const valor of valores
    ) {

      const celda =
        document.createElement(
          "td"
        );


      celda.textContent =
        String(
          valor ?? "—"
        );


      fila.appendChild(
        celda
      );
    }


    cuerpo.appendChild(
      fila
    );
  }
}


// ============================================================
// INFORMACIÓN GENERAL DEL SERVIDOR
// ============================================================

function infoServidor(datos) {

  const sistema =
    datos.sistema || {};


  texto(
    "nombre-servidor",
    sistema.hostname || "—"
  );


  texto(
    "sistema-operativo",

    [
      sistema.distribucion,
      sistema.version
    ]
      .filter(Boolean)
      .join(" ")

    ||

    sistema.plataforma

    ||

    "—"
  );


  texto(
    "arquitectura-servidor",
    sistema.arquitectura || "—"
  );


  // ----------------------------------------------------------
  // DIRECCIÓN IP
  // ----------------------------------------------------------

  const interfaces =
    Array.isArray(
      datos.red?.interfaces
    )
      ? datos.red.interfaces
      : [];


  const ip =
    interfaces.find(
      interfaz =>

        interfaz.ip4 &&

        !interfaz.ip4.startsWith(
          "127."
        ) &&

        interfaz.ip4 !==
        "0.0.0.0"
    )?.ip4;


  texto(
    "ip-servidor",
    ip || "—"
  );


  // ----------------------------------------------------------
  // UPTIME
  // ----------------------------------------------------------

  const segundos =
    numero(
      datos.uptime
    );


  let uptimeTexto =
    "—";


  if (segundos !== null) {

    const dias =
      Math.floor(
        segundos /
        86400
      );


    const horas =
      Math.floor(
        (
          segundos %
          86400
        ) /
        3600
      );


    const minutos =
      Math.floor(
        (
          segundos %
          3600
        ) /
        60
      );


    uptimeTexto =
      `${dias} d, ${horas} h, ${minutos} min`;
  }


  texto(
    "uptime-servidor",
    uptimeTexto
  );


  texto(
    "uptime-servidor-info",
    uptimeTexto
  );


  texto(
    "tipo-datos",
    "Reales (API / Socket.IO)"
  );
}


// ============================================================
// PROCESAR MÉTRICAS RECIBIDAS
// ============================================================

function procesarMetricas(datos) {

  if (
    !datos ||
    typeof datos !== "object" ||
    !datos.cpu ||
    !datos.memoria
  ) {

    console.warn(
      "Se recibieron métricas incompletas."
    );

    return;
  }


  // ==========================================================
  // CPU
  // ==========================================================

  const cpu =
    porcentaje(
      datos.cpu.usoPorcentaje
    );


  // ==========================================================
  // RAM
  // ==========================================================

  let ram =
    porcentaje(
      datos.memoria.usoPorcentaje
    );


  if (
    ram === null &&
    numero(datos.memoria.total) > 0
  ) {

    ram =
      porcentaje(
        numero(datos.memoria.usada) /
        numero(datos.memoria.total) *
        100
      );
  }


  // ==========================================================
  // DISCO
  // ==========================================================

  const discos =
    Array.isArray(
      datos.discos
    )
      ? datos.discos
      : [];


  const discoPrincipal =
    discos

      .filter(
        disco =>
          porcentaje(
            disco.usoPorcentaje
          ) !== null
      )

      .sort(
        (
          a,
          b
        ) =>
          numero(
            b.usoPorcentaje
          ) -
          numero(
            a.usoPorcentaje
          )
      )[0];


  const disco =
    discoPrincipal
      ? porcentaje(
          discoPrincipal.usoPorcentaje
        )
      : null;


  // ==========================================================
  // TEMPERATURA
  // ==========================================================

  const temperatura =
    numero(
      datos.cpu.temperatura
    );


  // ==========================================================
  // MOSTRAR VALORES
  // ==========================================================

  texto(
    "cpu",
    formato(cpu)
  );


  texto(
    "ram",
    formato(ram)
  );


  texto(
    "disco",
    formato(disco)
  );


  texto(
    "temperatura-cpu",
    formato(temperatura)
  );


  // ==========================================================
  // GAUGES
  // ==========================================================

  actualizarGauge(
    "gauge-cpu",
    cpu
  );


  actualizarGauge(
    "gauge-ram",
    ram
  );


  actualizarGauge(
    "gauge-disco",
    disco
  );


  actualizarGauge(
    "gauge-temperatura",
    temperatura,
    120
  );


  // ==========================================================
  // RED
  // ==========================================================

  const interfacesActivas =
    new Set(

      (
        datos.red?.interfaces ||
        []
      )

        .filter(
          interfaz =>

            interfaz.estado ===
              "up" &&

            interfaz.nombre !==
              "lo" &&

            interfaz.nombre !==
              "lo0"
        )

        .map(
          interfaz =>
            interfaz.nombre
        )
    );


  const trafico =
    (
      datos.red?.trafico ||
      []
    )

      .filter(
        interfaz =>
          interfacesActivas.has(
            interfaz.nombre
          )
      );


  const rx =
    trafico.reduce(
      (
        total,
        interfaz
      ) =>

        total +
        (
          numero(
            interfaz.recibidosPorSegundo
          ) || 0
        ),

      0
    );


  const tx =
    trafico.reduce(
      (
        total,
        interfaz
      ) =>

        total +
        (
          numero(
            interfaz.enviadosPorSegundo
          ) || 0
        ),

      0
    );


  texto(
    "red-entrada",

    trafico.length
      ? formato(
          rx * 8 / 1e6,
          3
        )
      : "—"
  );


  texto(
    "red-salida",

    trafico.length
      ? formato(
          tx * 8 / 1e6,
          3
        )
      : "—"
  );


  // ==========================================================
  // GRÁFICO
  // ==========================================================

  guardarMedicion(
    historialCPU,
    cpu
  );


  guardarMedicion(
    historialRAM,
    ram
  );


  dibujarGraficoRecursos();


  // ==========================================================
  // ESTADO GENERAL Y ALERTAS
  // ==========================================================

  estadoGeneral(
    datos.estadoGeneral
  );


  alertasActivas(
    datos.alertas
  );


  // ==========================================================
  // INFORMACIÓN GENERAL
  // ==========================================================

  infoServidor(datos);


  // ==========================================================
  // PROCESOS
  // ==========================================================

  const procesos =
    Array.isArray(
      datos.procesos
    )
      ? datos.procesos
      : [];


  texto(
    "procesos-activos",
    procesos.length
  );


  tabla(

    "tabla-procesos",

    procesos.map(
      proceso => [

        proceso.pid,

        proceso.nombre,

        formato(
          proceso.cpuPorcentaje,
          2
        ),

        formato(
          proceso.memoriaPorcentaje,
          2
        ),

        proceso.estado || "—"
      ]
    ),

    5,

    "No hay procesos disponibles."
  );


  // ==========================================================
  // SERVICIOS
  // ==========================================================

  const servicios =
    Array.isArray(
      datos.servicios
    )
      ? datos.servicios
      : [];


  tabla(

    "tabla-servicios",

    servicios.map(
      servicio => [

        servicio.nombre,

        servicio.estado
      ]
    ),

    2,

    "No hay servicios disponibles."
  );


  // ==========================================================
  // HORA DE ACTUALIZACIÓN
  // ==========================================================

  ultimaRecepcion =
    Date.now();


  /*
   * Formato de 24 horas.
   *
   * Ejemplo:
   * 26/10/2026, 22:23:15
   */
  const ahora =
    formatoFechaHora(
      new Date()
    );


  texto(
    "hora-actualizacion",
    ahora
  );


  texto(
    "sidebar-hora",
    ahora
  );


  estadoConexion(true);
}


// ============================================================
// CONSULTAR SISTEMA POR REST
// ============================================================

async function consultarSistema() {

  try {

    const datos =
      await obtenerJSON(
        "/api/sistema"
      );


    procesarMetricas(datos);


  } catch (error) {

    if (
      Date.now() -
      ultimaRecepcion >
      10000
    ) {

      estadoConexion(
        false,
        "No se pudo consultar /api/sistema."
      );
    }


    console.warn(
      "Consulta de sistema:",
      error.message
    );
  }
}


// ============================================================
// CONSULTAR HISTORIAL DE EVENTOS
// ============================================================

async function consultarEventos() {

  try {

    const eventos =
      await obtenerJSON(
        "/api/eventos"
      );


    if (
      !Array.isArray(eventos)
    ) {

      return;
    }


    /*
     * Mostramos primero los eventos más recientes.
     *
     * También usamos formato de 24 horas
     * para mantener consistencia en todo el dashboard.
     */
    const filas =
      eventos

        .slice(-100)

        .reverse()

        .map(
          evento => {

            const fecha =
              evento.fecha
                ? new Date(
                    evento.fecha
                  )
                : null;


            return [

              fecha
                ? formatoFechaHora(
                    fecha
                  )
                : "—",

              evento.recurso,

              evento.mensaje,

              evento.nivel
            ];
          }
        );


    tabla(
      "tabla-historial",
      filas,
      4,
      "Sin eventos registrados."
    );


  } catch (error) {

    console.warn(
      "Consulta de eventos:",
      error.message
    );
  }
}


// ============================================================
// CONSULTAR UMBRALES
// ============================================================

async function consultarUmbrales() {

  try {

    const umbrales =
      await obtenerJSON(
        "/api/config/umbrales"
      );


    const recursos = [
      "cpu",
      "memoria",
      "temperatura",
      "disco"
    ];


    for (
      const recurso of recursos
    ) {

      if (!umbrales[recurso]) {

        throw new Error(
          `Falta configuración de ${recurso}`
        );
      }


      const advertencia =
        Number(
          umbrales[recurso]
            .advertencia
        );


      const critico =
        Number(
          umbrales[recurso]
            .critico
        );


      if (
        !Number.isFinite(
          advertencia
        ) ||
        !Number.isFinite(
          critico
        )
      ) {

        throw new Error(
          `Umbrales inválidos para ${recurso}`
        );
      }


      // ------------------------------------------------------
      // FORMULARIO
      // ------------------------------------------------------

      const campoAdvertencia =
        $(
          `${recurso}-advertencia`
        );


      const campoCritico =
        $(
          `${recurso}-critico`
        );


      if (campoAdvertencia) {

        campoAdvertencia.value =
          advertencia;
      }


      if (campoCritico) {

        campoCritico.value =
          critico;
      }


      // ------------------------------------------------------
      // ETIQUETAS JUNTO A LOS GAUGES
      // ------------------------------------------------------

      const unidad =
        recurso ===
        "temperatura"
          ? "°C"
          : "%";


      texto(
        `${recurso}-advertencia-label`,
        `${advertencia}${unidad}`
      );


      texto(
        `${recurso}-critico-label`,
        `${critico}${unidad}`
      );
    }


    texto(
      "mensaje-configuracion",
      ""
    );


    return true;


  } catch (error) {

    console.error(
      "Error cargando umbrales:",
      error
    );


    texto(
      "mensaje-configuracion",
      "No se pudieron leer los umbrales."
    );


    return false;
  }
}


// ============================================================
// GUARDAR UMBRALES
// ============================================================

async function guardarUmbrales(
  evento
) {

  evento.preventDefault();


  const nuevos = {};


  const recursos = [
    "cpu",
    "memoria",
    "temperatura",
    "disco"
  ];


  for (
    const recurso of recursos
  ) {

    const campoAdvertencia =
      $(
        `${recurso}-advertencia`
      );


    const campoCritico =
      $(
        `${recurso}-critico`
      );


    if (
      !campoAdvertencia ||
      !campoCritico
    ) {

      texto(
        "mensaje-configuracion",
        "Faltan campos de configuración."
      );

      return;
    }


    const advertencia =
      Number(
        campoAdvertencia.value
      );


    const critico =
      Number(
        campoCritico.value
      );


    const maximo =
      recurso ===
      "temperatura"
        ? 120
        : 100;


    if (
      !Number.isFinite(
        advertencia
      ) ||
      !Number.isFinite(
        critico
      ) ||
      advertencia < 0 ||
      advertencia > maximo ||
      critico < 0 ||
      critico > maximo ||
      critico <= advertencia
    ) {

      texto(
        "mensaje-configuracion",

        `Valores inválidos en ${recurso}: crítico debe ser mayor a advertencia.`
      );


      return;
    }


    nuevos[recurso] = {
      advertencia,
      critico
    };
  }


  try {

    const respuesta =
      await fetch(
        apiBase +
        "/api/config/umbrales",

        {
          method:
            "PUT",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              nuevos
            )
        }
      );


    if (!respuesta.ok) {

      throw new Error(
        `HTTP ${respuesta.status}`
      );
    }


    texto(
      "mensaje-configuracion",
      "Umbrales guardados correctamente."
    );


    await consultarUmbrales();

    await consultarSistema();


  } catch (error) {

    console.error(
      "Error guardando umbrales:",
      error
    );


    texto(
      "mensaje-configuracion",

      `No se pudieron guardar los umbrales: ${error.message}`
    );
  }
}


// ============================================================
// CARGAR CLIENTE SOCKET.IO
// ============================================================

function cargarSocketIO(
  generacion
) {

  /*
   * Socket.IO publica automáticamente su cliente en:
   *
   * /socket.io/socket.io.js
   */
  const etiqueta =
    document.createElement(
      "script"
    );


  etiqueta.src =
    apiBase +
    "/socket.io/socket.io.js";


  etiqueta.onload =
    () => {

      if (
        generacion !==
        instanciaConexion
      ) {

        return;
      }


      if (
        typeof window.io !==
        "function"
      ) {

        console.warn(
          "El cliente Socket.IO no está disponible."
        );

        return;
      }


      socket =
        window.io(
          apiBase,
          {
            reconnection:
              true,

            timeout:
              10000
          }
        );


      // ------------------------------------------------------
      // CONEXIÓN EXITOSA
      // ------------------------------------------------------

      socket.on(
        "connect",

        async () => {

          estadoConexion(
            true,
            "Socket.IO conectado."
          );


          await consultarSistema();

          await consultarEventos();

          await consultarUmbrales();
        }
      );


      // ------------------------------------------------------
      // MÉTRICAS EN TIEMPO REAL
      // ------------------------------------------------------

      socket.on(
        "metricas",

        datos => {

          procesarMetricas(
            datos
          );
        }
      );


      // ------------------------------------------------------
      // DESCONEXIÓN
      // ------------------------------------------------------

      socket.on(
        "disconnect",

        () => {

          estadoConexion(
            false,
            "Socket.IO desconectado. Se utilizará REST como respaldo."
          );
        }
      );


      // ------------------------------------------------------
      // ERROR
      // ------------------------------------------------------

      socket.on(
        "connect_error",

        error => {

          console.warn(
            "Socket.IO:",
            error.message
          );
        }
      );
    };


  /*
   * Si Socket.IO no carga,
   * REST continúa funcionando.
   */
  etiqueta.onerror =
    () => {

      console.warn(
        "No se pudo cargar Socket.IO; se utilizará REST."
      );
    };


  document.head.appendChild(
    etiqueta
  );
}


// ============================================================
// CONECTAR AL BACKEND
// ============================================================

function conectar() {

  instanciaConexion += 1;


  const generacion =
    instanciaConexion;


  // ----------------------------------------------------------
  // CERRAR CONEXIÓN ANTERIOR
  // ----------------------------------------------------------

  if (socket) {

    socket.disconnect();

    socket = null;
  }


  // ----------------------------------------------------------
  // LIMPIAR INTERVALOS
  // ----------------------------------------------------------

  if (intervaloRespaldo) {

    clearInterval(
      intervaloRespaldo
    );

    intervaloRespaldo = null;
  }


  if (intervaloEventos) {

    clearInterval(
      intervaloEventos
    );

    intervaloEventos = null;
  }


  ultimaRecepcion = 0;


  historialCPU.length = 0;
  historialRAM.length = 0;


  estadoConexion(
    false,
    `Conectando a ${apiBase}...`
  );


  // ----------------------------------------------------------
  // PRIMERA CARGA REST
  // ----------------------------------------------------------

  consultarSistema();

  consultarEventos();

  consultarUmbrales();


  // ----------------------------------------------------------
  // SOCKET.IO
  // ----------------------------------------------------------

  cargarSocketIO(
    generacion
  );


  // ----------------------------------------------------------
  // REST COMO RESPALDO
  // ----------------------------------------------------------

  intervaloRespaldo =
    setInterval(
      () => {

        if (
          !socket?.connected ||
          Date.now() -
          ultimaRecepcion >
          7000
        ) {

          consultarSistema();
        }


        if (
          ultimaRecepcion &&
          Date.now() -
          ultimaRecepcion >
          15000
        ) {

          estadoConexion(
            false,
            "Sin datos recientes del backend."
          );
        }

      },

      5000
    );


  // ----------------------------------------------------------
  // HISTORIAL DE EVENTOS
  // ----------------------------------------------------------

  intervaloEventos =
    setInterval(
      consultarEventos,
      15000
    );
}


// ============================================================
// NAVEGACIÓN LATERAL
// ============================================================

function configurarNavegacion() {

  const enlaces =
    document.querySelectorAll(
      ".sidebar-nav a"
    );


  enlaces.forEach(
    enlace => {

      enlace.addEventListener(
        "click",
        () => {

          enlaces.forEach(
            otro =>
              otro.classList.remove(
                "activo"
              )
          );


          enlace.classList.add(
            "activo"
          );
        }
      );
    }
  );
}


// ============================================================
// INICIO DE LA APLICACIÓN
// ============================================================

document.addEventListener(
  "DOMContentLoaded",

  () => {

    // --------------------------------------------------------
    // MOSTRAR BACKEND ACTUAL
    // --------------------------------------------------------

    const inputServidor =
      $("input-ip-servidor");


    if (inputServidor) {

      inputServidor.value =
        apiBase;
    }


    texto(
      "sidebar-servidor",

      (() => {

        try {

          return new URL(
            apiBase
          ).host;

        } catch {

          return apiBase;
        }

      })()
    );


    // --------------------------------------------------------
    // CAMBIAR MANUALMENTE EL BACKEND
    // --------------------------------------------------------

    const formularioServidor =
      $("form-servidor");


    if (formularioServidor) {

      formularioServidor.addEventListener(
        "submit",

        evento => {

          evento.preventDefault();


          const valor =
            inputServidor
              ?.value
              .trim()
              .replace(
                /\/+$/,
                ""
              );


          try {

            const url =
              new URL(valor);


            if (
              ![
                "http:",
                "https:"
              ].includes(
                url.protocol
              ) ||

              url.username ||

              url.password ||

              (
                url.pathname !== "/" &&
                url.pathname !== ""
              ) ||

              url.search ||

              url.hash
            ) {

              throw new Error(
                "URL inválida"
              );
            }


            apiBase =
              url.origin;


            localStorage.setItem(
              "linuxguardBackend",
              apiBase
            );


            inputServidor.value =
              apiBase;


            texto(
              "mensaje-servidor",
              `Dirección configurada: ${apiBase}`
            );


            conectar();


          } catch (error) {

            texto(
              "mensaje-servidor",

              "Usá una URL válida, por ejemplo http://192.168.0.66:3000"
            );
          }
        }
      );
    }


    // --------------------------------------------------------
    // FORMULARIO DE UMBRALES
    // --------------------------------------------------------

    const formularioConfiguracion =
      $("form-configuracion");


    if (formularioConfiguracion) {

      formularioConfiguracion.addEventListener(
        "submit",
        guardarUmbrales
      );
    }


    // --------------------------------------------------------
    // NAVEGACIÓN
    // --------------------------------------------------------

    configurarNavegacion();


    // --------------------------------------------------------
    // CONEXIÓN INICIAL
    // --------------------------------------------------------

    conectar();
  }
);


// ============================================================
// REDIBUJAR GRÁFICO AL CAMBIAR TAMAÑO
// ============================================================

window.addEventListener(
  "resize",

  () => {

    dibujarGraficoRecursos();
  }
);