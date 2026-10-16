// Importamos funciones para leer archivos.
import { readFile } from "fs/promises";

// Importamos herramientas para construir rutas.
import path from "path";
import { fileURLToPath } from "url";

// Obtenemos la ruta real de este archivo.
const __filename = fileURLToPath(import.meta.url);

// Obtenemos la carpeta actual.
const __dirname = path.dirname(__filename);

// Construimos la ruta hacia:
// backend/config/thresholds.json
const CONFIG_PATH = path.join(
  __dirname,
  "../config/thresholds.json"
);

// ----------------------------------------------------
// LEER UMBRALES
// ----------------------------------------------------

export async function obtenerUmbrales() {
  try {

    // Leemos el archivo de configuración.
    const contenido = await readFile(
      CONFIG_PATH,
      "utf-8"
    );

    // Convertimos el JSON a objeto JavaScript.
    return JSON.parse(contenido);

  } catch (error) {

    console.error(
      "Error leyendo configuración de umbrales:",
      error
    );

    throw error;
  }
}