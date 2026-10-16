// ----------------------------------------------------
// IMPORTACIONES
// ----------------------------------------------------

// readFile permite leer archivos.
// writeFile permite modificar archivos.
import {
  readFile,
  writeFile
} from "fs/promises";

// Herramientas para manejar rutas.
import path from "path";
import { fileURLToPath } from "url";


// ----------------------------------------------------
// RUTA DEL ARCHIVO DE CONFIGURACIÓN
// ----------------------------------------------------

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

// Ruta hacia:
// backend/config/thresholds.json
const CONFIG_PATH = path.join(
  __dirname,
  "../config/thresholds.json"
);


// ----------------------------------------------------
// LEER UMBRALES
// ----------------------------------------------------

export async function obtenerUmbrales() {

  // Leemos el archivo como texto.
  const contenido = await readFile(
    CONFIG_PATH,
    "utf-8"
  );

  // Convertimos el JSON a objeto JavaScript.
  return JSON.parse(contenido);
}


// ----------------------------------------------------
// VALIDAR UMBRALES
// ----------------------------------------------------

// Antes de guardar una configuración nueva,
// comprobamos que tenga valores correctos.
function validarUmbrales(umbrales) {

  const recursos = [
    "cpu",
    "memoria",
    "temperatura",
    "disco"
  ];

  for (const recurso of recursos) {

    // Comprobamos que exista cada recurso.
    if (!umbrales[recurso]) {
      return false;
    }

    const advertencia =
      Number(umbrales[recurso].advertencia);

    const critico =
      Number(umbrales[recurso].critico);

    // Los valores deben ser números.
    if (
      Number.isNaN(advertencia) ||
      Number.isNaN(critico)
    ) {
      return false;
    }

    // Los valores no pueden ser negativos.
    if (
      advertencia < 0 ||
      critico < 0
    ) {
      return false;
    }

    // El nivel crítico debe ser mayor
    // que el nivel de advertencia.
    if (critico <= advertencia) {
      return false;
    }
  }

  return true;
}


// ----------------------------------------------------
// GUARDAR UMBRALES
// ----------------------------------------------------

export async function guardarUmbrales(
  nuevosUmbrales
) {

  // Validamos antes de escribir el archivo.
  if (!validarUmbrales(nuevosUmbrales)) {

    throw new Error(
      "Configuración de umbrales inválida"
    );
  }

  // Convertimos el objeto JavaScript
  // a JSON con formato legible.
  const contenido = JSON.stringify(
    nuevosUmbrales,
    null,
    2
  );

  // Guardamos la nueva configuración.
  await writeFile(
    CONFIG_PATH,
    contenido
  );

  // Devolvemos lo que acabamos de guardar.
  return nuevosUmbrales;
}