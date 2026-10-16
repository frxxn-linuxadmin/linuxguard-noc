
const historialCPU = [];
const historialRAM = [];
const MAX_MEDICIONES = 20;

const CLAVE_HISTORIAL = "linuxguard_historial_alertas";
const MAX_ALERTAS = 100;

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

    if (valor >= 80) {
        barra.style.backgroundColor = "#ef4444";
    } else if (valor >= 60) {
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

function actualizarRecursos() {
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
    
    // Guardar las mediciones
    guardarMedicion(historialCPU, cpu);
    guardarMedicion(historialRAM, ram);

    // Dibujar los gráficos
    dibujarGrafico("grafico-cpu", historialCPU, "#38bdf8");
    dibujarGrafico("grafico-ram", historialRAM, "#22c55e");

    // Comprobamos si hay alertas
    verificarAlertas(cpu, ram, disco);
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

// Iniciar monitoreo simulado
actualizarRecursos();
setInterval(actualizarRecursos, 3000);