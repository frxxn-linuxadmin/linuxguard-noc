# LinuxGuard NOC

Sistema de monitoreo de recursos GNU/Linux desarrollado como TP Integrador Final de Práctica Profesionalizante III.

## Organización del trabajo

- Rama `franco`: backend Node.js, Express, systeminformation, API, Socket.IO y alertas.
- Rama `lucio`: frontend HTML, CSS y JavaScript, dashboard, gráficos y consumo de API.
- Rama `main`: integración después de probar ambas partes.

## Probar en una misma PC

1. Desde `backend/` ejecutar `pnpm install` (solo la primera vez) y `pnpm start`.
2. Comprobar `http://localhost:3000/api/sistema`.
3. Desde `frontend/` ejecutar `python3 -m http.server 5500` en Linux o `py -m http.server 5500` en Windows (si Python está instalado).
4. Abrir `http://localhost:5500` y configurar la URL del backend como `http://localhost:3000`.
5. Comprobar CPU, RAM, red, procesos, servicios, alertas e historial.

## Conectar dos computadoras o VMs

En el campo **Dirección del backend** indicar `http://IP_DEL_BACKEND:3000` con la IP actual de la máquina donde corre Node.js. `localhost` solo funciona cuando el backend se ejecuta en el mismo dispositivo que abre el navegador. Ambos equipos deben poder comunicarse y el puerto 3000 debe estar accesible.

## Endpoints de backend

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/sistema` | Métricas, procesos, servicios y alertas |
| GET | `/api/eventos` | Historial persistente |
| GET | `/api/config/umbrales` | Consultar umbrales |
| PUT | `/api/config/umbrales` | Guardar configuración validada |
| Socket.IO | `metricas` | Métricas en tiempo real |

## Consideraciones

- Los gráficos muestran las últimas 20 muestras desde que se abrió la página, no un historial persistente.
- No se incluye un botón para borrar eventos porque el backend actual no implementa DELETE `/api/eventos`.
- El estado `inactive` en los servicios debe interpretarse con cuidado: el backend actual puede indicar `inactive` también cuando un servicio no existe.
- El archivo `data/events.json` debe existir en el backend y contener inicialmente `[]`.
- La configuración CORS abierta y el PUT sin autenticación son adecuados solo para desarrollo y redes de laboratorio confiables. Antes de publicar la aplicación en Internet deben restringirse.
- HTML2APK requerirá configurar una URL de backend alcanzable desde Android; `localhost` en el móvil no es la PC.
