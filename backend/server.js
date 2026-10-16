// ----------------------------------------------------
// IMPORTACIONES
// ----------------------------------------------------

// Express crea el servidor web y las rutas HTTP.
import express from "express";

// CORS permite que el frontend pueda conectarse
// desde otro origen, por ejemplo otra PC o puerto.
import cors from "cors";

// createServer crea el servidor HTTP real
// que van a compartir Express y Socket.IO.
import { createServer } from "http";

// Server es el servidor de Socket.IO.
import { Server } from "socket.io";

// Obtiene métricas reales del sistema:
// CPU, RAM, discos, red, procesos, uptime, etc.
import { obtenerDatosSistema } from "./services/systemService.js";

// Analiza las métricas y determina estados:
// normal, advertencia o crítico.
import { analizarEstadoSistema } from "./services/alertService.js";

// Consulta el estado de servicios Linux
// como ssh, apache2 y nginx.
import { obtenerServicios } from "./services/serviceMonitor.js";

// Funciones para guardar y consultar
// el historial de eventos y alertas.
import {
  registrarEventos,
  obtenerEventos
} from "./services/eventService.js";


// ----------------------------------------------------
// CONFIGURACIÓN DE EXPRESS
// ----------------------------------------------------

// Creamos la aplicación Express.
const app = express();

// Puerto donde funcionará el backend.
const PORT = 3000;

// Activamos CORS.
app.use(cors());

// Permitimos recibir información en formato JSON.
app.use(express.json());


// ----------------------------------------------------
// SERVIDOR HTTP
// ----------------------------------------------------

// Creamos un servidor HTTP utilizando Express.
//
// Este servidor será compartido por:
//
// - Express para la API REST.
// - Socket.IO para comunicación en tiempo real.
const httpServer = createServer(app);


// ----------------------------------------------------
// SOCKET.IO
// ----------------------------------------------------

// Creamos el servidor Socket.IO.
const io = new Server(httpServer, {

  cors: {

    // Durante el desarrollo aceptamos conexiones
    // desde cualquier origen.
    origin: "*",

    // Métodos permitidos.
    methods: ["GET", "POST"]
  }

});


// ----------------------------------------------------
// RUTA PRINCIPAL
// ----------------------------------------------------

// Sirve para verificar rápidamente
// que el backend esté funcionando.
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
// API PRINCIPAL DEL SISTEMA
// ----------------------------------------------------

// Devuelve todas las métricas actuales.
//
// URL:
// http://localhost:3000/api/sistema
app.get("/api/sistema", async (req, res) => {

  try {

    // ------------------------------------------------
    // 1. OBTENER MÉTRICAS
    // ------------------------------------------------

    // Obtenemos información del sistema:
    // CPU, RAM, discos, red, procesos, etc.
    const datos = await obtenerDatosSistema();


    // ------------------------------------------------
    // 2. OBTENER SERVICIOS
    // ------------------------------------------------

    // Consultamos servicios de Linux.
    const servicios = await obtenerServicios();


    // ------------------------------------------------
    // 3. UNIR INFORMACIÓN
    // ------------------------------------------------

    // Creamos un nuevo objeto que contiene
    // todas las métricas y además los servicios.
    const datosConServicios = {
      ...datos,
      servicios
    };


    // ------------------------------------------------
    // 4. ANALIZAR ALERTAS
    // ------------------------------------------------

    // Analizamos las métricas usando los umbrales
    // definidos en config/thresholds.json.
    //
    // Ahora usamos await porque
    // analizarEstadoSistema() es async.
    const datosAnalizados =
      await analizarEstadoSistema(datosConServicios);


    // ------------------------------------------------
    // 5. GUARDAR EVENTOS
    // ------------------------------------------------

    // Si se detectaron alertas nuevas,
    // las guardamos en data/events.json.
    await registrarEventos(
      datosAnalizados.alertas
    );


    // ------------------------------------------------
    // 6. RESPONDER AL CLIENTE
    // ------------------------------------------------

    // Enviamos toda la información en formato JSON.
    res.json(datosAnalizados);

  } catch (error) {

    // Si algo falla, mostramos el error
    // en la consola del servidor.
    console.error(
      "Error obteniendo datos del sistema:",
      error
    );

    // Respondemos con código HTTP 500.
    res.status(500).json({
      error:
        "No se pudo obtener la información del sistema"
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

    // Leemos el contenido de events.json.
    const eventos = await obtenerEventos();

    // Lo devolvemos como JSON.
    res.json(eventos);

  } catch (error) {

    console.error(
      "Error obteniendo historial de eventos:",
      error
    );

    res.status(500).json({
      error:
        "No se pudo obtener el historial de eventos"
    });

  }

});


// ----------------------------------------------------
// SOCKET.IO - CONEXIONES EN TIEMPO REAL
// ----------------------------------------------------

// Se ejecuta cada vez que un cliente
// se conecta mediante Socket.IO.
io.on("connection", (socket) => {

  // Mostramos el ID del cliente conectado.
  console.log(
    "Cliente conectado:",
    socket.id
  );


  // --------------------------------------------------
  // ENVÍO AUTOMÁTICO DE MÉTRICAS
  // --------------------------------------------------

  // Cada 2 segundos obtenemos métricas nuevas
  // y las enviamos al frontend.
  const intervalo = setInterval(
    async () => {

      try {

        // ----------------------------------------------
        // 1. OBTENER MÉTRICAS
        // ----------------------------------------------

        const datos =
          await obtenerDatosSistema();


        // ----------------------------------------------
        // 2. OBTENER SERVICIOS
        // ----------------------------------------------

        const servicios =
          await obtenerServicios();


        // ----------------------------------------------
        // 3. UNIR INFORMACIÓN
        // ----------------------------------------------

        const datosConServicios = {
          ...datos,
          servicios
        };


        // ----------------------------------------------
        // 4. ANALIZAR ALERTAS
        // ----------------------------------------------

        // También usamos await acá porque
        // alertService lee los umbrales
        // desde thresholds.json.
        const datosAnalizados =
          await analizarEstadoSistema(
            datosConServicios
          );


        // ----------------------------------------------
        // 5. GUARDAR EVENTOS
        // ----------------------------------------------

        await registrarEventos(
          datosAnalizados.alertas
        );


        // ----------------------------------------------
        // 6. ENVIAR AL FRONTEND
        // ----------------------------------------------

        // Enviamos el evento llamado "metricas".
        //
        // Lucio puede recibirlo usando:
        //
        // socket.on("metricas", ...)
        socket.emit(
          "metricas",
          datosAnalizados
        );

      } catch (error) {

        console.error(
          "Error enviando métricas por Socket.IO:",
          error
        );

      }

    },

    // Se ejecuta cada 2000 milisegundos.
    2000
  );


  // --------------------------------------------------
  // DESCONEXIÓN DEL CLIENTE
  // --------------------------------------------------

  socket.on("disconnect", () => {

    console.log(
      "Cliente desconectado:",
      socket.id
    );

    // Eliminamos el intervalo para que
    // no siga ejecutándose innecesariamente.
    clearInterval(intervalo);

  });

});


// ----------------------------------------------------
// INICIAR SERVIDOR
// ----------------------------------------------------

// Iniciamos el servidor HTTP.
//
// Usamos httpServer.listen()
// y no app.listen()
// porque Express y Socket.IO
// comparten este servidor.
httpServer.listen(PORT, () => {

  console.log(
    `LinuxGuard NOC ejecutándose en http://localhost:${PORT}`
  );

});