
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
        if (recurso.valor >= 80) {
            agregarAlerta(
                recurso.nombre + " en estado crítico: " +
                recurso.valor + "%",
                "alerta-critica"
            );
        } else if (recurso.valor >= 60) {
            agregarAlerta(
                recurso.nombre + " con uso elevado: " +
                recurso.valor + "%",
                "alerta-advertencia"
            );
        }
    });

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

    document.getElementById("cpu").textContent = cpu;
    document.getElementById("ram").textContent = ram;
    document.getElementById("disco").textContent = disco;

    actualizarBarra("cpu", cpu);
    actualizarBarra("ram", ram);
    actualizarBarra("disco", disco);

    // Comprobamos si hay alertas
    verificarAlertas(cpu, ram, disco);
}

actualizarRecursos();
setInterval(actualizarRecursos, 3000);
