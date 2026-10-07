
function actualizarBarra(recurso, valor) {
    const barra = document.getElementById("barra-" + recurso);

    barra.style.width = valor + "%";

    if (valor >= 80) {
        barra.style.backgroundColor = "#ef4444"; // Rojo
    } else if (valor >= 60) {
        barra.style.backgroundColor = "#f59e0b"; // Amarillo
    } else {
        barra.style.backgroundColor = "#22c55e"; // Verde
    }
}

function actualizarRecursos() {
    // Datos simulados de CPU y RAM
    const cpu = Math.floor(Math.random() * 101);
    const ram = Math.floor(Math.random() * 101);

    // Disco simulado con valor fijo por ahora
    const disco = 60;

    document.getElementById("cpu").textContent = cpu;
    document.getElementById("ram").textContent = ram;
    document.getElementById("disco").textContent = disco;

    actualizarBarra("cpu", cpu);
    actualizarBarra("ram", ram);
    actualizarBarra("disco", disco);
}

actualizarRecursos();
setInterval(actualizarRecursos, 3000);
