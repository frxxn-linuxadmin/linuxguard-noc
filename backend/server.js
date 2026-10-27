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


// Puerto utilizado por LinuxGuard.
const PORT = 3000;


/*
 * 0.0.0.0 indica que Node.js debe escuchar
 * conexiones desde todas las interfaces de red.
 *
 * Esto permite acceder:
 *
 * - desde la misma PC usando localhost
 * - desde otra PC usando la IP del servidor
 *
 * Ejemplos:
 *
 * http://localhost:3000
 * http://192.168.x.x:3000
 * http://10.x.x.x:3000
 *
 * La IP NO queda fija en el código.
 */
const HOST = "0.0.0.0";


// Permitimos conexiones desde otros orígenes.
//
// CORS controla qué navegadores/orígenes pueden
// acceder a las APIs.
//
// IMPORTANTE:
// CORS no obtiene ni envía las métricas.
// Las métricas son obtenidas por systeminformation
// y transportadas por REST / Socket.IO.
app.use(cors());


// Permite que Express interprete JSON recibido.
//
// Se utiliza, por ejemplo, cuando el frontend
// envía nuevos umbrales mediante PUT.
app.use(express.json());


/*
 * PUBLICAR EL FRONTEND
 *
 * Express sirve automáticamente los archivos
 * que se encuentran en:
 *
 * backend/public/
 *
 * Por ejemplo:
 *
 * public/index.html
 * public/css/style.css
 * public/js/app.js
 *
 * Al entrar a:
 *
 * http://IP:3000/
 *
 * Express entrega automáticamente index.html.
 *
 * Esta estructura sigue la recomendación
 * utilizada en clase: frontend dentro de public.
 */
app.use(express.static("public"));


// ----------------------------------------------------
// SERVIDOR HTTP
// ----------------------------------------------------

/*
 * Creamos un único servidor HTTP.
 *
 * Sobre este mismo servidor funcionan:
 *
 * - Express
 * - API REST
 * - Socket.IO
 * - Frontend
 */
const httpServer = createServer(app);


// ----------------------------------------------------
// SOCKET.IO
// ----------------------------------------------------

/*
 * Socket.IO permite comunicación en tiempo real
 * entre backend y frontend.
 *
 * A diferencia de una consulta REST tradicional,
 * el servidor puede enviar información al cliente
 * sin esperar una nueva petición HTTP.
 */
const io = new Server(httpServer, {

  cors: {
    origin: "*",
    methods: [
      "GET",
      "POST",
      "PUT"
    ]
  }

});


// ----------------------------------------------------
// HEALTH CHECK DEL BACKEND
// ----------------------------------------------------

/*
 * Antes esta respuesta estaba en "/".
 *
 * Como ahora "/" es utilizado por public/index.html,
 * movemos la comprobación del backend a:
 *
 * GET /api/health
 *
 * De esta forma:
 *
 * /            -> Frontend
 * /api/health  -> Estado del backend
 */
app.get("/api/health", (req, res) => {

  res.json({
    proyecto: "LinuxGuard NOC",
    estado: "Backend funcionando"
  });

});


// ----------------------------------------------------
// API DEL SISTEMA
// ----------------------------------------------------

/*
 * Devuelve las métricas actuales del servidor.
 *
 * GET:
 * http://localhost:3000/api/sistema
 *
 * También puede utilizarse la IP real:
 *
 * http://IP_DEL_SERVIDOR:3000/api/sistema
 */
app.get("/api/sistema", async (req, res) => {

  try {

    // Obtenemos métricas reales del sistema GNU/Linux.
    const datos =
      await obtenerDatosSistema();


    // Consultamos el estado de servicios Linux.
    const servicios =
      await obtenerServicios();


    /*
     * Unimos las métricas generales
     * con la información de servicios.
     */
    const datosConServicios = {
      ...datos,
      servicios
    };


    /*
     * Analizamos las métricas utilizando
     * los umbrales configurados.
     *
     * Esto determina:
     *
     * - normal
     * - advertencia
     * - critico
     */
    const datosAnalizados =
      await analizarEstadoSistema(
        datosConServicios
      );


    /*
     * Si existen alertas nuevas,
     * se almacenan en el historial.
     */
    await registrarEventos(
      datosAnalizados.alertas
    );


    // Respondemos al frontend en formato JSON.
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

/*
 * Devuelve el historial persistente de eventos.
 *
 * GET:
 * http://localhost:3000/api/eventos
 */
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

/*
 * Devuelve los umbrales actuales.
 *
 * GET:
 * http://localhost:3000/api/config/umbrales
 *
 * Ejemplo de información:
 *
 * CPU
 * advertencia: 70
 * critico: 90
 */
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

/*
 * Permite cambiar los umbrales.
 *
 * PUT:
 * http://localhost:3000/api/config/umbrales
 *
 * El frontend envía un objeto JSON
 * mediante el cuerpo de la petición.
 */
app.put(
  "/api/config/umbrales",

  async (req, res) => {

    try {

      /*
       * req.body contiene el JSON
       * enviado desde el frontend.
       */
      const nuevosUmbrales =
        req.body;


      /*
       * configService valida y guarda
       * la nueva configuración.
       */
      const resultado =
        await guardarUmbrales(
          nuevosUmbrales
        );


      res.json({

        mensaje:
          "Umbrales actualizados correctamente",

        umbrales:
          resultado

      });

    } catch (error) {

      console.error(
        "Error actualizando umbrales:",
        error
      );


      /*
       * HTTP 400 indica que el cliente
       * envió información inválida.
       */
      res.status(400).json({
        error:
          "Configuración de umbrales inválida"
      });

    }

  }
);


// ----------------------------------------------------
// SOCKET.IO - TIEMPO REAL
// ----------------------------------------------------

/*
 * Este bloque se ejecuta cada vez que
 * un cliente se conecta mediante Socket.IO.
 *
 * "socket" representa a ese cliente específico.
 */
io.on("connection", (socket) => {

  console.log(
    "Cliente conectado:",
    socket.id
  );


  /*
   * Enviamos métricas al cliente
   * aproximadamente cada 2 segundos.
   *
   * Esta es la parte principal
   * del monitoreo en tiempo real.
   */
  const intervalo =
    setInterval(

      async () => {

        try {

          // Obtenemos métricas actuales.
          const datos =
            await obtenerDatosSistema();


          // Consultamos servicios GNU/Linux.
          const servicios =
            await obtenerServicios();


          // Unimos ambas fuentes de información.
          const datosConServicios = {
            ...datos,
            servicios
          };


          /*
           * Analizamos CPU, RAM, disco,
           * temperatura, etc. utilizando
           * los umbrales configurados.
           */
          const datosAnalizados =
            await analizarEstadoSistema(
              datosConServicios
            );


          // Registramos posibles alertas.
          await registrarEventos(
            datosAnalizados.alertas
          );


          /*
           * Enviamos la información al frontend.
           *
           * El frontend escucha el evento:
           *
           * socket.on("metricas", ...)
           *
           * De esta forma las métricas se
           * actualizan sin recargar la página.
           */
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


  // --------------------------------------------------
  // DESCONEXIÓN DEL CLIENTE
  // --------------------------------------------------

  socket.on("disconnect", () => {

    console.log(
      "Cliente desconectado:",
      socket.id
    );


    /*
     * Eliminamos el intervalo de este cliente
     * para evitar que continúe ejecutándose
     * una vez cerrada la conexión.
     */
    clearInterval(intervalo);

  });

});


// ----------------------------------------------------
// INICIAR SERVIDOR
// ----------------------------------------------------

/*
 * Iniciamos Node.js escuchando en:
 *
 * 0.0.0.0:3000
 *
 * Esto permite utilizar la IP que tenga
 * el servidor en cada red.
 *
 * Por ejemplo:
 *
 * Casa:
 * http://192.168.x.x:3000
 *
 * Universidad / VM:
 * http://10.x.x.x:3000
 *
 * No necesitamos modificar server.js
 * cuando cambia la dirección IP.
 */
httpServer.listen(PORT, HOST, () => {

  console.log(
    `LinuxGuard NOC ejecutándose en http://localhost:${PORT}`
  );

  console.log(
    `Acceso por red: http://IP_DEL_SERVIDOR:${PORT}`
  );

});