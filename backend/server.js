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

// Importamos nuestra función que obtiene las métricas del sistema.
import { obtenerDatosSistema } from "./services/systemService.js";

// Creamos la aplicación Express.
const app = express();

// Puerto donde funcionará el backend.
const PORT = 3000;

// Activamos CORS para Express.
app.use(cors());

// Permitimos recibir datos JSON.
app.use(express.json());

// ----------------------------------------------------
// SERVIDOR HTTP
// ----------------------------------------------------

// Creamos un servidor HTTP utilizando nuestra aplicación Express.
// Antes usábamos directamente app.listen().
// Ahora necesitamos este servidor HTTP para conectar Socket.IO.
const httpServer = createServer(app);


// ----------------------------------------------------
// SOCKET.IO
// ----------------------------------------------------

// Creamos el servidor Socket.IO.
// Le indicamos que acepte conexiones desde cualquier origen.
// Durante desarrollo usamos "*".
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});


// ----------------------------------------------------
// RUTAS HTTP
// ----------------------------------------------------

// Ruta principal.
// Sirve para comprobar rápidamente que el backend funciona.
app.get("/", (req, res) => {
  res.json({
    proyecto: "LinuxGuard NOC",
    estado: "Backend funcionando"
  });
});


// Endpoint de la API.
// Devuelve una fotografía de las métricas del sistema
// en el momento en que el cliente hace la petición.
app.get("/api/sistema", async (req, res) => {
  try {

    // Obtenemos las métricas utilizando nuestro servicio.
    const datos = await obtenerDatosSistema();

    // Respondemos al cliente con JSON.
    res.json(datos);

  } catch (error) {

    // Mostramos el error en la consola del servidor.
    console.error("Error obteniendo datos del sistema:", error);

    // Respondemos con código HTTP 500.
    res.status(500).json({
      error: "No se pudo obtener la información del sistema"
    });
  }
});


// ----------------------------------------------------
// CONEXIONES SOCKET.IO
// ----------------------------------------------------

// Este evento se ejecuta cada vez que un cliente
// se conecta mediante Socket.IO.
io.on("connection", (socket) => {

  // Mostramos en consola el identificador único del cliente.
  console.log("Cliente conectado:", socket.id);


  // Creamos un intervalo para enviar métricas
  // automáticamente cada 2 segundos.
  const intervalo = setInterval(async () => {

    try {

      // Obtenemos las métricas actualizadas.
      const datos = await obtenerDatosSistema();

      // Enviamos los datos solamente a este cliente.
      // "metricas" es el nombre del evento.
      socket.emit("metricas", datos);

    } catch (error) {

      console.error(
        "Error enviando métricas por Socket.IO:",
        error
      );
    }

  }, 2000);


  // Este evento se ejecuta cuando el cliente se desconecta.
  socket.on("disconnect", () => {

    console.log("Cliente desconectado:", socket.id);

    // Detenemos el intervalo para evitar que siga ejecutándose
    // después de que el cliente se haya desconectado.
    clearInterval(intervalo);
  });

});


// ----------------------------------------------------
// INICIAR SERVIDOR
// ----------------------------------------------------

// Antes usábamos app.listen().
// Ahora usamos httpServer.listen() porque Express y Socket.IO
// comparten el mismo servidor HTTP.
httpServer.listen(PORT, () => {

  console.log(
    `LinuxGuard NOC ejecutándose en http://localhost:${PORT}`
  );

});