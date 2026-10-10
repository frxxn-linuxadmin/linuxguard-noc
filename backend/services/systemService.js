// Importamos la librería systeminformation.
// Esta librería nos permite obtener información real del sistema operativo
// y del hardware donde está corriendo el backend.
import si from "systeminformation";

// Exportamos esta función para poder usarla desde server.js.
// "async" indica que la función realiza operaciones que pueden tardar
// y que vamos a esperar usando "await".
export async function obtenerDatosSistema() {

  // Obtiene información general del sistema operativo.
  const sistema = await si.osInfo();

  // Obtiene información física del procesador:
  // fabricante, modelo, cantidad de núcleos, velocidad, etc.
  const cpu = await si.cpu();

  // Obtiene el porcentaje de uso actual del procesador.
  const cargaCpu = await si.currentLoad();

  // Obtiene la temperatura actual del procesador.
  // En algunos equipos puede devolver null si el sensor no está disponible.
  const temperaturaCpu = await si.cpuTemperature();

  // Obtiene información de la memoria RAM.
  const memoria = await si.mem();

  // Obtiene información sobre los sistemas de archivos y particiones montadas.
  const discos = await si.fsSize();

  // Obtiene las interfaces de red disponibles.
  const interfacesRed = await si.networkInterfaces();

  // Obtiene estadísticas de tráfico de red.
  const traficoRed = await si.networkStats();

  // Obtiene datos relacionados con el tiempo de funcionamiento del sistema.
  const tiempo = si.time();

  // Retornamos un objeto con todos los datos ordenados.
  // Este objeto después se convierte en JSON desde server.js.
  return {

    // Información general del sistema.
    sistema: {
      hostname: sistema.hostname,
      plataforma: sistema.platform,
      distribucion: sistema.distro,
      version: sistema.release,
      kernel: sistema.kernel,
      arquitectura: sistema.arch
    },

    // Información del procesador.
    cpu: {
      fabricante: cpu.manufacturer,
      modelo: cpu.brand,
      nucleos: cpu.cores,
      nucleosFisicos: cpu.physicalCores,
      velocidadGHz: cpu.speed,

      // Redondeamos el uso del CPU a 2 decimales.
      usoPorcentaje: Number(cargaCpu.currentLoad.toFixed(2)),

      // Temperatura principal del CPU.
      temperatura: temperaturaCpu.main
    },

    // Información de memoria RAM.
    memoria: {
      total: memoria.total,
      usada: memoria.used,
      disponible: memoria.available
    },

    // Filtramos sistemas de archivos que no nos interesa mostrar
// en el dashboard, como efivarfs, tmpfs o pseudo-filesystems.
discos: discos

  // filter() deja pasar solamente los elementos
  // que cumplen la condición indicada.
  .filter((disco) => {

    // Lista de tipos de sistemas de archivos que queremos ignorar.
    const tiposIgnorados = [
      "efivarfs",
      "tmpfs",
      "devtmpfs",
      "overlay",
      "squashfs"
    ];

    // Solo devolvemos true si:
    // 1. El tipo NO está en la lista de ignorados.
    // 2. El tamaño del disco es mayor que 0.
    return (
      !tiposIgnorados.includes(disco.type) &&
      disco.size > 0
    );
  })

  // Después de filtrar, usamos map()
  // para generar el objeto limpio que enviamos al frontend.
  .map((disco) => ({
    sistemaArchivos: disco.fs,
    tipo: disco.type,
    puntoMontaje: disco.mount,
    total: disco.size,
    usado: disco.used,
    disponible: disco.available,
    usoPorcentaje: disco.use
  })),

    // Información relacionada con la red.
    red: {

      // Recorremos las interfaces de red disponibles.
      interfaces: interfacesRed.map((interfaz) => ({
        nombre: interfaz.iface,
        ip4: interfaz.ip4,
        ip6: interfaz.ip6,
        mac: interfaz.mac,
        estado: interfaz.operstate,
        velocidadMbps: interfaz.speed
      })),

      // Recorremos las estadísticas de tráfico.
      trafico: traficoRed.map((interfaz) => ({
        nombre: interfaz.iface,

        // Cantidad total de bytes recibidos.
        recibidosBytes: interfaz.rx_bytes,

        // Cantidad total de bytes enviados.
        enviadosBytes: interfaz.tx_bytes,

        // Velocidad aproximada de recepción.
        recibidosPorSegundo: interfaz.rx_sec,

        // Velocidad aproximada de envío.
        enviadosPorSegundo: interfaz.tx_sec
      }))
    },

    // Tiempo que lleva encendido el sistema, expresado en segundos.
    uptime: tiempo.uptime
  };
}