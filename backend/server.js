// Importamos Express para crear el servidor web.
import express from "express";

// Importamos CORS para permitir conexiones desde otro origen.
// Por ejemplo, desde el frontend de Lucio.
import cors from "cors";

// Importamos createServer para crear un servidor HTTP real.
// Socket.IO necesita trabajar sobre este servidor HTTP.
import { createServer } from "http";

// Importamos Server desde Socket.IO.
// Esto nos permite crear el servidor WebSocket.
import { Server } from "socket.io";

// Importamos la función que obtiene las métricas del sistema.
import { obtenerDatosSistema } from "./services/systemService.js";

// Importamos la función que analiza métricas
// y genera estados y alertas.
import { analizarEstadoSistema } from "./services/alertService.js";

// Importamos la función que consulta servicios de Linux.
import { obtenerServicios } from "./services/serviceMonitor.js";


// Importamos las funciones para guardar
// y consultar el historial de eventos.
import {
  registrarEventos,
  obtenerEventos
} from "./services/eventService.js";


// ----------------------------------------------------
// CONFIGURACIÓN DE EXPRESS
// ----------------------------------------------------

// Creamos la aplicación Express.
const app = express();

// Puerto donde funcionará LinuxGuard NOC.
const PORT = 3000;

// Permitimos conexiones desde otros orígenes.
app.use(cors());

// Permitimos que Express pueda recibir JSON.
app.use(express.json());


// ----------------------------------------------------
// SERVIDOR HTTP
// ----------------------------------------------------

// Creamos el servidor HTTP.
//
// Express manejará las rutas HTTP y Socket.IO
// utilizará este mismo servidor para las conexiones
// en tiempo real.
const httpServer = createServer(app);


// ----------------------------------------------------
// SOCKET.IO
// ----------------------------------------------------

// Creamos Socket.IO sobre nuestro servidor HTTP.
const io = new Server(httpServer, {
  cors: {
    // Durante desarrollo permitimos cualquier origen.
    origin: "*",

    // Métodos HTTP permitidos.
    methods: ["GET", "POST"]
  }
});


// ----------------------------------------------------
// RUTA PRINCIPAL
// ----------------------------------------------------

// Ruta simple para comprobar que el backend funciona.
//
// URL:
// http://localhost:3000/
app.get("/", (req, res) => {

  res.json({
    proyecto: "LinuxGuard NOC",
    estado: "Backend funcionando"
  });

});


// ----------------------------------------------------
// API DEL SISTEMA
// ----------------------------------------------------

// Endpoint principal.
//
// URL:
// http://localhost:3000/api/sistema
//
// Devuelve las métricas actuales del sistema,
// servicios, estados y alertas.
app.get("/api/sistema", async (req, res) => {

  try {

    // Obtenemos CPU, RAM, discos, red,
    // procesos, temperatura, etc.
    const datos = await obtenerDatosSistema();

    // Consultamos el estado de los servicios Linux.
    const servicios = await obtenerServicios();

    // Unimos las métricas con los servicios.
    //
    // "...datos" copia todo el contenido
    // del objeto datos.
    const datosConServicios = {
      ...datos,
      servicios
    };

// Analizamos las métricas y generamos
// estados y alertas.
const datosAnalizados =
  analizarEstadoSistema(datosConServicios);

// Guardamos en el historial las alertas detectadas.
await registrarEventos(datosAnalizados.alertas);

// Enviamos la respuesta completa al navegador.
res.json(datosAnalizados);

  } catch (error) {

    // Si algo falla, mostramos el error
    // en la terminal del backend.
    console.error(
      "Error obteniendo datos del sistema:",
      error
    );

    // Respondemos HTTP 500 al cliente.
    res.status(500).json({
      error: "No se pudo obtener la información del sistema"
    });

  }

});

// ----------------------------------------------------
// API DE EVENTOS
// ----------------------------------------------------

// Devuelve el historial de alertas guardadas.
//
// URL:
// http://localhost:3000/api/eventos
app.get("/api/eventos", async (req, res) => {

  try {

    // Leemos los eventos guardados.
    const eventos = await obtenerEventos();

    // Los enviamos al cliente en formato JSON.
    res.json(eventos);

  } catch (error) {

    console.error(
      "Error obteniendo historial de eventos:",
      error
    );

    res.status(500).json({
      error: "No se pudo obtener el historial de eventos"
    });

  }

});

// ----------------------------------------------------
// SOCKET.IO
// ----------------------------------------------------

// Se ejecuta cada vez que un cliente
// se conecta mediante Socket.IO.
io.on("connection", (socket) => {

  // Mostramos el ID único del cliente conectado.
  console.log("Cliente conectado:", socket.id);


  // Cada 2 segundos obtenemos información nueva.
  const intervalo = setInterval(async () => {

    try {

      // Obtenemos métricas actualizadas.
      const datos = await obtenerDatosSistema();

      // Obtenemos también los servicios Linux.
      const servicios = await obtenerServicios();

      // Unimos métricas y servicios.
      const datosConServicios = {
        ...datos,
        servicios
      };

// Analizamos estados y alertas.
const datosAnalizados =
  analizarEstadoSistema(datosConServicios);

// Guardamos las alertas nuevas
// en el historial.
await registrarEventos(datosAnalizados.alertas);

// Enviamos las métricas al cliente
// mediante el evento "metricas".
socket.emit("metricas", datosAnalizados);

    } catch (error) {

      console.error(
        "Error enviando métricas por Socket.IO:",
        error
      );

    }

  }, 2000);


  // Se ejecuta cuando el cliente se desconecta.
  socket.on("disconnect", () => {

    console.log(
      "Cliente desconectado:",
      socket.id
    );

    // Detenemos el intervalo correspondiente
    // a este cliente.
    clearInterval(intervalo);

  });

});


// ----------------------------------------------------
// INICIAR SERVIDOR
// ----------------------------------------------------

// Iniciamos el servidor HTTP.
//
// Como Socket.IO y Express comparten el mismo
// servidor, usamos httpServer.listen()
// y no app.listen().
httpServer.listen(PORT, () => {

  console.log(
    `LinuxGuard NOC ejecutándose en http://localhost:${PORT}`
  );

});