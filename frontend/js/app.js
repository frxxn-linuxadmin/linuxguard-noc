
const historialCPU = [];
const historialRAM = [];
const MAX_MEDICIONES = 20;

const CLAVE_HISTORIAL = "linuxguard_historial_alertas";
const MAX_ALERTAS = 100;

const CLAVE_UMBRALES = "linuxguard_umbrales";

let umbralAdvertencia = 60;
let umbralCritico = 80;
let servidorConectado = true;

// Recuperar la configuración guardada
try {
    const configuracion = JSON.parse(
        localStorage.getItem(CLAVE_UMBRALES)
    );

    if (
        configuracion &&
        Number.isInteger(configuracion.advertencia) &&
        Number.isInteger(configuracion.critico) &&
        configuracion.advertencia >= 1 &&
        configuracion.critico <= 100 &&
        configuracion.advertencia < configuracion.critico
    ) {
        umbralAdvertencia = configuracion.advertencia;
        umbralCritico = configuracion.critico;
    }
} catch (error) {
    console.error("Error al recuperar los umbrales:", error);
}


// Recuperamos los registros guardados en el navegador
let historialAlertas = [];

try {
    const datosGuardados = JSON.parse(
        localStorage.getItem(CLAVE_HISTORIAL)
    );

    if (Array.isArray(datosGuardados)) {
        historialAlertas = datosGuardados;
    }
} catch (error) {
    console.error("Error al recuperar el historial:", error);
}

// Recordamos el último estado de cada recurso
const estadosAnteriores = {};


function actualizarBarra(recurso, valor) {
    const barra = document.getElementById("barra-" + recurso);

    barra.style.width = valor + "%";

    if (valor >= umbralCritico) {
        barra.style.backgroundColor = "#ef4444";
    } else if (valor >= umbralAdvertencia) {
        barra.style.backgroundColor = "#f59e0b";
    } else {
        barra.style.backgroundColor = "#22c55e";
    }
}
   
function verificarAlertas(cpu, ram, disco) {
    const lista = document.getElementById("lista-alertas");

    // Limpiamos las alertas anteriores
    lista.innerHTML = "";

    const recursos = [
        { nombre: "CPU", valor: cpu },
        { nombre: "RAM", valor: ram },
        { nombre: "Disco", valor: disco }
    ];


    recursos.forEach(function(recurso) {
        let estado = "Normal";

        if (recurso.valor >= 80) {
            estado = "Crítico";

            agregarAlerta(
                recurso.nombre + " en estado crítico: " +
                recurso.valor + "%",
                "alerta-critica"
            );

        } else if (recurso.valor >= 60) {
            estado = "Advertencia";

            agregarAlerta(
                recurso.nombre + " con uso elevado: " +
                recurso.valor + "%",
                "alerta-advertencia"
            );
        }

        // Registrar solamente al entrar o cambiar
        // a un estado de alerta
        if (
            estado !== "Normal" &&
            estadosAnteriores[recurso.nombre] !== estado
        ) {
            registrarHistorial(
                recurso.nombre,
                recurso.valor,
                estado
            );
        }

        estadosAnteriores[recurso.nombre] = estado;
    });
    
    // Si no hay advertencias, mostramos estado normal
    if (lista.children.length === 0) {
        agregarAlerta(
            "Todos los recursos están dentro de los límites normales.",
            "alerta-normal"
        );
    }
    



    // Si no hay advertencias, mostramos estado normal
    if (lista.children.length === 0) {
        agregarAlerta(
            "Todos los recursos están dentro de los límites normales.",
            "alerta-normal"
        );
    }
}

function agregarAlerta(mensaje, tipo) {
    const lista = document.getElementById("lista-alertas");

    const alerta = document.createElement("div");
    alerta.className = "alerta " + tipo;
    alerta.textContent = mensaje;

    lista.appendChild(alerta);
}


function actualizarEstadoGeneral(cpu, ram, disco) {
    const panel = document.getElementById("panel-estado");
    const texto = document.getElementById("texto-estado");
    const descripcion = document.getElementById("descripcion-estado");

    // Tomamos el recurso con mayor utilización
    const mayorUso = Math.max(cpu, ram, disco);

    if (mayorUso >= umbralCritico) {
        panel.className = "estado-critico";
        texto.textContent = "CRÍTICO";
        descripcion.textContent =
            "Se detectaron recursos en estado crítico.";

    } else if (mayorUso >= umbralAdvertencia) {
        panel.className = "estado-advertencia";
        texto.textContent = "ADVERTENCIA";
        descripcion.textContent =
            "Se detectó un uso elevado de recursos.";

    } else {
        panel.className = "estado-normal";
        texto.textContent = "NORMAL";
        descripcion.textContent =
            "Todos los recursos están dentro de los límites normales.";
    }
}


function actualizarRecursos() {
    
    // No actualizar métricas si el servidor está desconectado
    if (!servidorConectado) {
        return;
    }

    // Datos simulados
    const cpu = Math.floor(Math.random() * 101);
    const ram = Math.floor(Math.random() * 101);
    const disco = 60;
    
    // Simulación de tráfico de red en Mbps
    const entrada = (Math.random() * 100).toFixed(1);
    const salida = (Math.random() * 50).toFixed(1);

    document.getElementById("red-entrada").textContent = entrada;
    document.getElementById("red-salida").textContent = salida;


    document.getElementById("cpu").textContent = cpu;
    document.getElementById("ram").textContent = ram;
    document.getElementById("disco").textContent = disco;

    actualizarBarra("cpu", cpu);
    actualizarBarra("ram", ram);
    actualizarBarra("disco", disco);
    

    
// Actualizar el estado general del servidor
actualizarEstadoGeneral(cpu, ram, disco);

    
    // Guardar las mediciones
    guardarMedicion(historialCPU, cpu);
    guardarMedicion(historialRAM, ram);

    // Dibujar los gráficos
    dibujarGrafico("grafico-cpu", historialCPU, "#38bdf8");
    dibujarGrafico("grafico-ram", historialRAM, "#22c55e");

    // Comprobamos si hay alertas
    verificarAlertas(cpu, ram, disco);
}

function cambiarConexion() {
    servidorConectado = !servidorConectado;

    const panel = document.getElementById("panel-conexion");
    const texto = document.getElementById("texto-conexion");
    const descripcion = document.getElementById("descripcion-conexion");
    const boton = document.getElementById("simular-conexion");
    const aviso = document.getElementById("aviso-desconexion");

    if (servidorConectado) {
        panel.className = "conexion-activa";
        texto.textContent = "CONECTADO";

        descripcion.textContent =
            "El servidor se encuentra disponible (simulación).";

        boton.textContent = "Simular desconexión";

        aviso.hidden = true;

        // Reanudar el monitoreo inmediatamente
        actualizarRecursos();

    } else {
        panel.className = "conexion-inactiva";
        texto.textContent = "DESCONECTADO";

        descripcion.textContent =
            "El servidor no responde (simulación).";

        boton.textContent = "Simular conexión";

        aviso.hidden = false;
    }
}


function guardarMedicion(historial, valor) {
    historial.push(valor);

    if (historial.length > MAX_MEDICIONES) {
        historial.shift();
    }
}

function dibujarGrafico(idCanvas, datos, color) {
    const canvas = document.getElementById(idCanvas);

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const ancho = canvas.width;
    const alto = canvas.height;
    const margen = 35;

    // Limpiar el gráfico anterior
    ctx.clearRect(0, 0, ancho, alto);

    // Dibujar líneas horizontales
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;

    for (let porcentaje = 0; porcentaje <= 100; porcentaje += 25) {
        const y = alto - margen -
            (porcentaje / 100) * (alto - 2 * margen);

        ctx.beginPath();
        ctx.moveTo(margen, y);
        ctx.lineTo(ancho - margen, y);
        ctx.stroke();

        ctx.fillStyle = "#94a3b8";
        ctx.font = "12px Arial";
        ctx.fillText(porcentaje + "%", 2, y + 4);
    }

    if (datos.length === 0) return;

    // Dibujar el historial
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();

    datos.forEach(function(valor, indice) {
        const x = margen + indice *
            (ancho - 2 * margen) / (MAX_MEDICIONES - 1);

        const y = alto - margen -
            (valor / 100) * (alto - 2 * margen);

        if (indice === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.stroke();
}

function registrarHistorial(recurso, valor, estado) {
    const registro = {
        hora: new Date().toLocaleString("es-AR"),
        recurso: recurso,
        valor: valor,
        estado: estado
    };

    historialAlertas.unshift(registro);

    // Mantener solamente los últimos 100 registros
    if (historialAlertas.length > MAX_ALERTAS) {
        historialAlertas.pop();
    }

    try {
        localStorage.setItem(
            CLAVE_HISTORIAL,
            JSON.stringify(historialAlertas)
        );
    } catch (error) {
        console.error("Error al guardar el historial:", error);
    }

    mostrarHistorial();
}

function mostrarHistorial() {
    const tabla = document.getElementById("tabla-historial");
    tabla.innerHTML = "";

    if (historialAlertas.length === 0) {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");

        celda.colSpan = 4;
        celda.textContent = "Sin alertas registradas.";

        fila.appendChild(celda);
        tabla.appendChild(fila);
        return;
    }

    historialAlertas.forEach(function(registro) {
        const fila = document.createElement("tr");

        const valores = [
            registro.hora,
            registro.recurso,
            registro.valor + "%",
            registro.estado
        ];

        valores.forEach(function(valor) {
            const celda = document.createElement("td");
            celda.textContent = valor;
            fila.appendChild(celda);
        });

        tabla.appendChild(fila);
    });
}

function borrarHistorial() {
    const confirmar = confirm(
        "¿Estás seguro de que querés borrar el historial?"
    );

    if (!confirmar) return;

    historialAlertas = [];

    localStorage.removeItem(CLAVE_HISTORIAL);

    mostrarHistorial();
}


// Mostrar los registros guardados al abrir la página
mostrarHistorial();

// Activar el botón de borrado
document.getElementById("borrar-historial")
    .addEventListener("click", borrarHistorial);

  
function guardarConfiguracion(evento) {
    evento.preventDefault();

    const advertencia = Number(
        document.getElementById("umbral-advertencia").value
    );

    const critico = Number(
        document.getElementById("umbral-critico").value
    );

    const mensaje = document.getElementById(
        "mensaje-configuracion"
    );

    if (
        !Number.isInteger(advertencia) ||
        !Number.isInteger(critico) ||
        advertencia < 1 ||
        advertencia >= critico ||
        critico > 100
    ) {
        mensaje.textContent =
            "La advertencia debe ser menor que el nivel crítico.";
        mensaje.style.color = "#ef4444";
        return;
    }

    try {
        localStorage.setItem(
            CLAVE_UMBRALES,
            JSON.stringify({
                advertencia: advertencia,
                critico: critico
            })
        );
    } catch (error) {
        mensaje.textContent =
            "No se pudo guardar la configuración.";
        mensaje.style.color = "#ef4444";
        return;
    }

    umbralAdvertencia = advertencia;
    umbralCritico = critico;

    mensaje.textContent = "Configuración guardada correctamente.";
    mensaje.style.color = "#22c55e";

    // Reiniciar estados para evaluar los nuevos límites
    Object.keys(estadosAnteriores).forEach(function(recurso) {
        delete estadosAnteriores[recurso];
    });

    actualizarRecursos();
}
  
// Mostrar en el formulario los umbrales guardados
document.getElementById("umbral-advertencia").value =
    umbralAdvertencia;

document.getElementById("umbral-critico").value =
    umbralCritico;

// Escuchar el envío del formulario
document.getElementById("form-configuracion")
    .addEventListener("submit", guardarConfiguracion);

// Activar botón de simulación de conexión
document.getElementById("simular-conexion")
    .addEventListener("click", cambiarConexion);

// Iniciar monitoreo simulado
actualizarRecursos();
setInterval(actualizarRecursos, 3000);