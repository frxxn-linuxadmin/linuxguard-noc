// Importamos funciones para leer y escribir archivos.
import { readFile, writeFile } from "fs/promises";

// Importamos utilidades para trabajar con rutas.
import path from "path";
import { fileURLToPath } from "url";


// ----------------------------------------------------
// RUTA DEL ARCHIVO DE EVENTOS
// ----------------------------------------------------

// Obtenemos la ruta real de este archivo.
const __filename = fileURLToPath(import.meta.url);

// Obtenemos la carpeta donde está este archivo.
const __dirname = path.dirname(__filename);

// Construimos la ruta hacia:
// backend/data/events.json
const EVENTOS_PATH = path.join(
  __dirname,
  "../data/events.json"
);


// ----------------------------------------------------
// LEER EVENTOS
// ----------------------------------------------------

// Esta función lee el historial guardado.
export async function obtenerEventos() {

  try {

    // Leemos el archivo events.json.
    const contenido = await readFile(
      EVENTOS_PATH,
      "utf-8"
    );

    // Convertimos el texto JSON a un array de JavaScript.
    return JSON.parse(contenido);

  } catch (error) {

    console.error(
      "Error leyendo historial de eventos:",
      error
    );

    // Si ocurre un problema devolvemos una lista vacía.
    return [];
  }
}


// ----------------------------------------------------
// REGISTRAR ALERTAS
// ----------------------------------------------------

// Esta función recibe las alertas generadas
// por alertService.js.
export async function registrarEventos(alertas) {

  // Si no hay alertas, no hacemos nada.
  if (!alertas || alertas.length === 0) {
    return;
  }

  // Leemos los eventos ya guardados.
  const eventos = await obtenerEventos();

  // Recorremos cada alerta actual.
  for (const alerta of alertas) {

    // Buscamos el último evento guardado
    // del mismo recurso.
    const ultimoEvento = [...eventos]
      .reverse()
      .find(
        (evento) =>
          evento.recurso === alerta.recurso
      );

    // Evitamos guardar exactamente la misma alerta
    // cada 2 segundos.
    const alertaRepetida =
      ultimoEvento &&
      ultimoEvento.nivel === alerta.nivel &&
      ultimoEvento.mensaje === alerta.mensaje;

    if (alertaRepetida) {
      continue;
    }

    // Creamos el nuevo evento.
    const nuevoEvento = {
      id: Date.now(),

      fecha: new Date().toISOString(),

      recurso: alerta.recurso,

      nivel: alerta.nivel,

      mensaje: alerta.mensaje
    };

    // Agregamos el evento al historial.
    eventos.push(nuevoEvento);
  }

  // Para evitar que el archivo crezca infinitamente,
  // conservamos solamente los últimos 200 eventos.
  const eventosLimitados = eventos.slice(-200);

  // Guardamos nuevamente todo el historial.
  await writeFile(
    EVENTOS_PATH,
    JSON.stringify(eventosLimitados, null, 2)
  );
}