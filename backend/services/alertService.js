// Este servicio analiza las métricas obtenidas del sistema
// y determina si cada recurso está en estado normal,
// advertencia o crítico.

// Importamos la configuración de umbrales desde configService.js.
import { obtenerUmbrales } from "./configService.js";


// ----------------------------------------------------
// FUNCIÓN PARA DETERMINAR EL ESTADO
// ----------------------------------------------------

// Recibe:
// valor = valor actual del recurso
// advertencia = límite desde el cual avisamos
// critico = límite desde el cual consideramos crítico
function obtenerEstado(valor, advertencia, critico) {

  // Si no tenemos un valor válido, devolvemos "desconocido".
  if (
    valor === null ||
    valor === undefined ||
    Number.isNaN(valor)
  ) {
    return "desconocido";
  }

  // Si supera o iguala el límite crítico.
  if (valor >= critico) {
    return "critico";
  }

  // Si supera o iguala el límite de advertencia.
  if (valor >= advertencia) {
    return "advertencia";
  }

  // Si no supera ningún límite.
  return "normal";
}


// ----------------------------------------------------
// ANALIZAR MÉTRICAS DEL SISTEMA
// ----------------------------------------------------

// La función ahora es async porque necesita leer
// el archivo thresholds.json mediante obtenerUmbrales().
export async function analizarEstadoSistema(datos) {

  // Leemos los umbrales configurados.
  const umbrales = await obtenerUmbrales();

  // Array donde vamos a guardar las alertas detectadas.
  const alertas = [];


  // --------------------------------------------------
  // CPU
  // --------------------------------------------------

  const estadoCpu = obtenerEstado(
    datos.cpu.usoPorcentaje,
    umbrales.cpu.advertencia,
    umbrales.cpu.critico
  );

  if (estadoCpu !== "normal") {
    alertas.push({
      recurso: "cpu",
      nivel: estadoCpu,
      mensaje: `Uso de CPU en ${datos.cpu.usoPorcentaje}%`
    });
  }


  // --------------------------------------------------
  // MEMORIA RAM
  // --------------------------------------------------

  // Calculamos el porcentaje de RAM utilizada.
  const porcentajeMemoria =
    (datos.memoria.usada / datos.memoria.total) * 100;

  // Redondeamos a dos decimales.
  const porcentajeMemoriaRedondeado =
    Number(porcentajeMemoria.toFixed(2));

  const estadoMemoria = obtenerEstado(
    porcentajeMemoriaRedondeado,
    umbrales.memoria.advertencia,
    umbrales.memoria.critico
  );

  if (estadoMemoria !== "normal") {
    alertas.push({
      recurso: "memoria",
      nivel: estadoMemoria,
      mensaje:
        `Uso de memoria en ${porcentajeMemoriaRedondeado}%`
    });
  }


  // --------------------------------------------------
  // TEMPERATURA CPU
  // --------------------------------------------------

  const estadoTemperatura = obtenerEstado(
    datos.cpu.temperatura,
    umbrales.temperatura.advertencia,
    umbrales.temperatura.critico
  );

  if (
    estadoTemperatura !== "normal" &&
    estadoTemperatura !== "desconocido"
  ) {
    alertas.push({
      recurso: "temperatura",
      nivel: estadoTemperatura,
      mensaje:
        `Temperatura del CPU en ${datos.cpu.temperatura} °C`
    });
  }


  // --------------------------------------------------
  // DISCOS
  // --------------------------------------------------

  const discosAnalizados = datos.discos.map((disco) => {

    const estado = obtenerEstado(
      disco.usoPorcentaje,
      umbrales.disco.advertencia,
      umbrales.disco.critico
    );

    // Si el disco está en advertencia o crítico,
    // agregamos una alerta.
    if (estado !== "normal") {
      alertas.push({
        recurso: "disco",
        nivel: estado,
        mensaje:
          `Disco ${disco.puntoMontaje} en ${disco.usoPorcentaje}%`
      });
    }

    // Conservamos los datos originales del disco
    // y agregamos su estado.
    return {
      ...disco,
      estado
    };
  });


  // --------------------------------------------------
  // ESTADO GENERAL
  // --------------------------------------------------

  let estadoGeneral = "normal";

  // Si existe al menos una alerta crítica,
  // todo el sistema se considera crítico.
  if (
    alertas.some(
      (alerta) => alerta.nivel === "critico"
    )
  ) {
    estadoGeneral = "critico";

  // Si no hay críticas pero sí advertencias,
  // el sistema queda en advertencia.
  } else if (
    alertas.some(
      (alerta) => alerta.nivel === "advertencia"
    )
  ) {
    estadoGeneral = "advertencia";
  }


  // --------------------------------------------------
  // RESULTADO
  // --------------------------------------------------

  return {
    ...datos,

    cpu: {
      ...datos.cpu,
      estado: estadoCpu
    },

    memoria: {
      ...datos.memoria,
      usoPorcentaje: porcentajeMemoriaRedondeado,
      estado: estadoMemoria
    },

    discos: discosAnalizados,

    estadoGeneral,

    alertas
  };
}