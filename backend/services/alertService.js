// Este servicio analiza las métricas obtenidas del sistema
// y determina si cada recurso está en estado normal,
// advertencia o crítico.

// ----------------------------------------------------
// FUNCIÓN PARA DETERMINAR EL ESTADO DE UN PORCENTAJE
// ----------------------------------------------------

// Recibe:
// valor = porcentaje actual
// advertencia = límite a partir del cual avisamos
// critico = límite a partir del cual consideramos crítico
function obtenerEstado(valor, advertencia, critico) {

  // Si no tenemos un valor válido, devolvemos desconocido.
  if (valor === null || valor === undefined || Number.isNaN(valor)) {
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

  // Si no supera ninguno de los límites anteriores,
  // consideramos que el recurso funciona normalmente.
  return "normal";
}


// ----------------------------------------------------
// ANALIZAR MÉTRICAS DEL SISTEMA
// ----------------------------------------------------

export function analizarEstadoSistema(datos) {

  // Array donde vamos a guardar las alertas detectadas.
  const alertas = [];


  // --------------------------------------------------
  // CPU
  // --------------------------------------------------

  const estadoCpu = obtenerEstado(
    datos.cpu.usoPorcentaje,
    70,
    90
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

  const porcentajeMemoriaRedondeado =
    Number(porcentajeMemoria.toFixed(2));

  const estadoMemoria = obtenerEstado(
    porcentajeMemoriaRedondeado,
    75,
    90
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
    70,
    85
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
      80,
      90
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

    // Conservamos toda la información original del disco
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
  if (alertas.some((alerta) => alerta.nivel === "critico")) {
    estadoGeneral = "critico";

  // Si no hay críticas pero sí advertencias,
  // el estado general pasa a advertencia.
  } else if (
    alertas.some((alerta) => alerta.nivel === "advertencia")
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