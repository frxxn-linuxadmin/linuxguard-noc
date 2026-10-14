// Importamos execFile para ejecutar comandos del sistema
// de forma controlada desde Node.js.
import { execFile } from "child_process";

// promisify nos permite usar execFile con async/await.
import { promisify } from "util";

const execFileAsync = promisify(execFile);


// ----------------------------------------------------
// CONSULTAR ESTADO DE UN SERVICIO
// ----------------------------------------------------

// Esta función recibe el nombre de un servicio Linux,
// por ejemplo "ssh" o "nginx".
async function obtenerEstadoServicio(nombre) {
  try {

    // Ejecutamos:
    // systemctl is-active <servicio>
    //
    // Si el servicio está activo, systemctl devuelve "active".
    const { stdout } = await execFileAsync(
      "systemctl",
      ["is-active", nombre]
    );

    return {
      nombre,
      estado: stdout.trim()
    };

  } catch (error) {

    // Si systemctl devuelve error, normalmente significa
    // que el servicio está inactivo, no existe o falló.
    return {
      nombre,
      estado: "inactive"
    };
  }
}


// ----------------------------------------------------
// LISTA DE SERVICIOS A MONITOREAR
// ----------------------------------------------------

export async function obtenerServicios() {

  // Definimos qué servicios queremos vigilar.
  const servicios = [
    "ssh",
    "nginx",
    "apache2"
  ];

  // Promise.all ejecuta todas las consultas en paralelo.
  const resultados = await Promise.all(
    servicios.map((servicio) =>
      obtenerEstadoServicio(servicio)
    )
  );

  return resultados;
}