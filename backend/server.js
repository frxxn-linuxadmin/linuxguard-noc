// ----------------------------------------------------
// IMPORTACIONES
// ----------------------------------------------------

import express from "express";
import cors from "cors";

import { createServer } from "http";
import { Server } from "socket.io";

// Métricas del sistema.
import {
  obtenerDatosSistema
} from "./services/systemService.js";

// Estados y alertas.
import {
  analizarEstadoSistema
} from "./services/alertService.js";

// Servicios Linux.
import {
  obtenerServicios
} from "./services/serviceMonitor.js";

// Historial de eventos.
import {
  registrarEventos,
  obtenerEventos
} from "./services/eventService.js";

// Configuración de umbrales.
import {
  obtenerUmbrales,
  guardarUmbrales
} from "./services/configService.js";


// ----------------------------------------------------
// CONFIGURACIÓN DE EXPRESS
// ----------------------------------------------------

const app = express();

const PORT = 3000;

// Permitimos conexiones desde otros orígenes.
app.use(cors());

// Permitimos recibir JSON.
app.use(express.json());


// ----------------------------------------------------
// SERVIDOR HTTP
// ----------------------------------------------------

const httpServer = createServer(app);


// ----------------------------------------------------
// SOCKET.IO
// ----------------------------------------------------

const io = new Server(httpServer, {

  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT"]
  }

});


// ----------------------------------------------------
// RUTA PRINCIPAL
// ----------------------------------------------------

app.get("/", (req, res) => {

  res.json({
    proyecto: "LinuxGuard NOC",
    estado: "Backend funcionando"
  });

});


// ----------------------------------------------------
// API DEL SISTEMA
// ----------------------------------------------------

// Devuelve las métricas actuales.
//
// GET:
// http://localhost:3000/api/sistema
app.get("/api/sistema", async (req, res) => {

  try {

    // Obtenemos métricas del sistema.
    const datos =
      await obtenerDatosSistema();

    // Obtenemos estado de servicios Linux.
    const servicios =
      await obtenerServicios();

    // Unimos ambos resultados.
    const datosConServicios = {
      ...datos,
      servicios
    };

    // Analizamos alertas usando
    // los umbrales configurados.
    const datosAnalizados =
      await analizarEstadoSistema(
        datosConServicios
      );

    // Guardamos alertas nuevas.
    await registrarEventos(
      datosAnalizados.alertas
    );

    // Respondemos al cliente.
    res.json(datosAnalizados);

  } catch (error) {

    console.error(
      "Error obteniendo datos del sistema:",
      error
    );

    res.status(500).json({
      error:
        "No se pudo obtener la información del sistema"
    });

  }

});


// ----------------------------------------------------
// API DE EVENTOS
// ----------------------------------------------------

// Devuelve el historial.
//
// GET:
// http://localhost:3000/api/eventos
app.get("/api/eventos", async (req, res) => {

  try {

    const eventos =
      await obtenerEventos();

    res.json(eventos);

  } catch (error) {

    console.error(
      "Error obteniendo historial:",
      error
    );

    res.status(500).json({
      error:
        "No se pudo obtener el historial"
    });

  }

});


// ----------------------------------------------------
// API DE CONFIGURACIÓN - CONSULTAR
// ----------------------------------------------------

// Devuelve los umbrales actuales.
//
// GET:
// http://localhost:3000/api/config/umbrales
app.get(
  "/api/config/umbrales",
  async (req, res) => {

    try {

      const umbrales =
        await obtenerUmbrales();

      res.json(umbrales);

    } catch (error) {

      console.error(
        "Error obteniendo umbrales:",
        error
      );

      res.status(500).json({
        error:
          "No se pudieron obtener los umbrales"
      });

    }

  }
);


// ----------------------------------------------------
// API DE CONFIGURACIÓN - MODIFICAR
// ----------------------------------------------------

// Permite cambiar los umbrales.
//
// PUT:
// http://localhost:3000/api/config/umbrales
app.put(
  "/api/config/umbrales",
  async (req, res) => {

    try {

      // req.body contiene el JSON enviado
      // por el frontend.
      const nuevosUmbrales =
        req.body;

      // Validamos y guardamos.
      const resultado =
        await guardarUmbrales(
          nuevosUmbrales
        );

      res.json({
        mensaje:
          "Umbrales actualizados correctamente",

        umbrales: resultado
      });

    } catch (error) {

      console.error(
        "Error actualizando umbrales:",
        error
      );

      // 400 significa que el cliente envió
      // datos inválidos.
      res.status(400).json({
        error:
          "Configuración de umbrales inválida"
      });

    }

  }
);


// ----------------------------------------------------
// SOCKET.IO
// ----------------------------------------------------

io.on("connection", (socket) => {

  console.log(
    "Cliente conectado:",
    socket.id
  );


  // Enviamos métricas cada 2 segundos.
  const intervalo = setInterval(
    async () => {

      try {

        // Métricas.
        const datos =
          await obtenerDatosSistema();

        // Servicios.
        const servicios =
          await obtenerServicios();

        // Unimos la información.
        const datosConServicios = {
          ...datos,
          servicios
        };

        // Analizamos estados y alertas.
        const datosAnalizados =
          await analizarEstadoSistema(
            datosConServicios
          );

        // Guardamos alertas.
        await registrarEventos(
          datosAnalizados.alertas
        );

        // Enviamos todo al frontend.
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
    2000
  );


  // Cuando el cliente se desconecta.
  socket.on("disconnect", () => {

    console.log(
      "Cliente desconectado:",
      socket.id
    );

    clearInterval(intervalo);

  });

});


// ----------------------------------------------------
// INICIAR SERVIDOR
// ----------------------------------------------------

httpServer.listen(PORT, () => {

  console.log(
    `LinuxGuard NOC ejecutándose en http://localhost:${PORT}`
  );

});