// =====================================================
// VOTACIONES ESCUELA SARMIENTO
// SCRIPT PRINCIPAL
// =====================================================


// =====================================================
// CREAR PERFIL
// =====================================================

document.addEventListener("DOMContentLoaded", function () {

    const registroForm =
        document.getElementById("registroForm");

    if (registroForm) {

        registroForm.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();

                const nombre =
                    document.getElementById("nombre").value;

                const usuario =
                    document.getElementById("usuario").value;

                const contrasena =
                    document.getElementById("contrasena").value;

                const tipoPerfil =
                    document.getElementById("tipoPerfil").value;

                try {

                    const respuesta =
                        await fetch(
                            "http://localhost:3000/usuarios",
                            {
                                method: "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json"
                                },

                                body: JSON.stringify({
                                    nombre: nombre,
                                    apellido: "",
                                    usuario: usuario,
                                    contrasena: contrasena,
                                    tipoPerfil: tipoPerfil
                                })
                            }
                        );

                    const datos =
                        await respuesta.json();

                    if (!respuesta.ok) {

                        alert(
                            "No se pudo crear el perfil."
                        );

                        return;
                    }

                    const perfil = {
                        nombre: nombre,
                        usuario: usuario,
                        contrasena: contrasena,
                        tipoPerfil: tipoPerfil
                    };

                    localStorage.setItem(
                        "perfil",
                        JSON.stringify(perfil)
                    );

                    alert(
                        "¡Perfil creado correctamente!"
                    );

                } catch (error) {

                    console.error(error);

                    alert(
                        "No se pudo conectar con el servidor."
                    );

                }

            }
        );

    }

});


// =====================================================
// INICIAR SESIÓN
// =====================================================

document.addEventListener("DOMContentLoaded", function () {

    const loginForm =
        document.getElementById("loginForm");

    if (loginForm) {

        loginForm.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();

                const usuarioIngresado =
                    document.getElementById("usuario").value;

                const contrasenaIngresada =
                    document.getElementById("contrasena").value;

                try {

                    const respuesta =
                        await fetch(
                            "http://localhost:3000/login",
                            {
                                method: "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json"
                                },

                                body: JSON.stringify({
                                    usuario:
                                        usuarioIngresado,

                                    contrasena:
                                        contrasenaIngresada
                                })
                            }
                        );

                    const datos =
                        await respuesta.json();

                    if (!respuesta.ok) {

                        alert(
                            datos.mensaje ||
                            "Usuario o contraseña incorrectos."
                        );

                        return;
                    }

                    const perfil = {
                        nombre: datos.usuario.nombre,
                        usuario: datos.usuario.usuario,
                        contrasena:
                            contrasenaIngresada,
                        tipoPerfil:
                            datos.usuario.tipoPerfil
                    };

                    localStorage.setItem(
                        "perfil",
                        JSON.stringify(perfil)
                    );

                    alert(
                        "¡Inicio de sesión correcto!"
                    );

                    if (
                        datos.usuario.tipoPerfil ===
                        "estudiante"
                    ) {

                        window.location.href =
                            "estudiante.html";

                    } else if (
                        datos.usuario.tipoPerfil ===
                        "candidato"
                    ) {

                        window.location.href =
                            "candidato.html";

                    }

                } catch (error) {

                    console.error(error);

                    alert(
                        "No se pudo conectar con el servidor."
                    );

                }

            }
        );

    }

});


// =====================================================
// MOSTRAR RESULTADOS
// =====================================================

document.addEventListener("DOMContentLoaded", function () {

    const votosJuanElemento =
        document.getElementById("votosJuan");

    const votosMartinaElemento =
        document.getElementById("votosMartina");


    if (votosJuanElemento) {

        const votosJuan =
            Number(
                localStorage.getItem("votosJuan")
            ) || 0;

        votosJuanElemento.textContent =
            votosJuan;

    }


    if (votosMartinaElemento) {

        const votosMartina =
            Number(
                localStorage.getItem("votosMartina")
            ) || 0;

        votosMartinaElemento.textContent =
            votosMartina;

    }

});


// =====================================================
// CONFIRMAR VOTO
// =====================================================

function confirmarVoto(candidato) {

    const yaVoto =
        localStorage.getItem("yaVoto");


    if (yaVoto === "true") {

        alert(
            "Ya registraste tu voto."
        );

        return;

    }


    const confirmar =
        confirm(
            "¿Estás seguro de que querés votar por "
            + candidato + "?"
        );


    if (confirmar) {

        localStorage.setItem(
            "yaVoto",
            "true"
        );

        localStorage.setItem(
            "candidatoVotado",
            candidato
        );


        if (candidato === "Juan Pérez") {

            let votosJuan =
                Number(
                    localStorage.getItem("votosJuan")
                ) || 0;

            votosJuan++;

            localStorage.setItem(
                "votosJuan",
                votosJuan
            );

        }


        if (candidato === "Martina López") {

            let votosMartina =
                Number(
                    localStorage.getItem("votosMartina")
                ) || 0;

            votosMartina++;

            localStorage.setItem(
                "votosMartina",
                votosMartina
            );

        }


        alert(
            "Tu voto por "
            + candidato
            + " fue registrado correctamente."
        );

    }

}


// =====================================================
// MOSTRAR PROYECTO DEL CANDIDATO
// =====================================================

document.addEventListener("DOMContentLoaded", function () {

    const nombreCandidato =
        document.getElementById(
            "nombreCandidato"
        );

    const proyectoCandidato =
        document.getElementById(
            "proyectoCandidato"
        );


    if (
        nombreCandidato &&
        proyectoCandidato
    ) {

        const parametros =
            new URLSearchParams(
                window.location.search
            );

        const candidato =
            parametros.get("candidato");


        if (candidato === "juan") {

            nombreCandidato.textContent =
                "Juan Pérez";


            const proyectoJuan =
                localStorage.getItem(
                    "proyectoJuan"
                );


            if (proyectoJuan) {

                proyectoCandidato.textContent =
                    proyectoJuan;

            } else {

                proyectoCandidato.textContent =
                    "Este candidato todavía no presentó su proyecto.";

            }

        }


        if (candidato === "martina") {

            nombreCandidato.textContent =
                "Martina López";


            const proyectoMartina =
                localStorage.getItem(
                    "proyectoMartina"
                );


            if (proyectoMartina) {

                proyectoCandidato.textContent =
                    proyectoMartina;

            } else {

                proyectoCandidato.textContent =
                    "Este candidato todavía no presentó su proyecto.";

            }

        }

    }

});


// =====================================================
// GUARDAR PROYECTO DEL CANDIDATO
// =====================================================

document.addEventListener("DOMContentLoaded", function () {

    const proyecto =
        document.getElementById(
            "proyecto"
        );

    const guardarProyecto =
        document.getElementById(
            "guardarProyecto"
        );


    if (
        proyecto &&
        guardarProyecto
    ) {

        const perfilGuardado =
            localStorage.getItem(
                "perfil"
            );


        let nombreCandidato =
            "";


        if (perfilGuardado) {

            const perfil =
                JSON.parse(
                    perfilGuardado
                );

            nombreCandidato =
                perfil.nombre;

        }


        const nombreCandidatoPanel =
            document.getElementById(
                "nombreCandidatoPanel"
            );


        if (
            nombreCandidatoPanel &&
            perfilGuardado
        ) {

            const perfil =
                JSON.parse(
                    perfilGuardado
                );

            nombreCandidatoPanel.textContent =
                "Candidato: " + perfil.nombre;

        }


        let claveProyecto =
            "proyectoCandidato";


        if (
            nombreCandidato ===
            "Juan Pérez"
        ) {

            claveProyecto =
                "proyectoJuan";

        }


        if (
            nombreCandidato ===
            "Martina López"
        ) {

            claveProyecto =
                "proyectoMartina";

        }


        const proyectoGuardado =
            localStorage.getItem(
                claveProyecto
            );


        if (proyectoGuardado) {

            proyecto.value =
                proyectoGuardado;

        }


        guardarProyecto.addEventListener(
            "click",
            function () {

                const textoProyecto =
                    proyecto.value.trim();


                if (
                    textoProyecto === ""
                ) {

                    alert(
                        "Escribí tu proyecto antes de guardarlo."
                    );

                    return;

                }


                localStorage.setItem(
                    claveProyecto,
                    textoProyecto
                );


                alert(
                    "¡Proyecto guardado correctamente!"
                );

            }
        );

    }

});
// =====================================================
// CHAT
// =====================================================

document.addEventListener("DOMContentLoaded", function () {

    const chatForm =
        document.getElementById("chatForm");

    const mensajesElemento =
        document.getElementById("mensajes");


    if (
        chatForm &&
        mensajesElemento
    ) {


        // ---------------------------------------------
        // OBTENER PERFIL ACTUAL
        // ---------------------------------------------

        const perfilGuardado =
            localStorage.getItem("perfil");


        let usuarioActual =
            "Usuario";

        let tipoPerfilActual =
            "";


        if (perfilGuardado) {

            const perfil =
                JSON.parse(perfilGuardado);

            usuarioActual =
                perfil.nombre;

            tipoPerfilActual =
                perfil.tipoPerfil;

        }


        // ---------------------------------------------
        // MOSTRAR MENSAJES
        // ---------------------------------------------

        async function cargarMensajes() {

            try {

                const respuesta =
                    await fetch(
                        "http://localhost:3000/mensajes"
                    );


                const mensajes =
                    await respuesta.json();


                mensajesElemento.innerHTML = "";


                mensajes.forEach(function (mensaje) {

                    const div =
                        document.createElement("div");


                    div.style.marginBottom =
                        "10px";


                    div.innerHTML =
                        "<strong>"
                        + mensaje.usuario
                        + "</strong>: "
                        + mensaje.mensaje;


                    mensajesElemento.appendChild(
                        div
                    );

                });


                mensajesElemento.scrollTop =
                    mensajesElemento.scrollHeight;


            } catch (error) {

                console.error(error);

                mensajesElemento.innerHTML =
                    "<p>No se pudieron cargar los mensajes.</p>";

            }

        }


        // ---------------------------------------------
        // ENVIAR MENSAJE
        // ---------------------------------------------

        chatForm.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();


                const mensajeInput =
                    document.getElementById(
                        "mensaje"
                    );


                const mensaje =
                    mensajeInput.value.trim();


                if (mensaje === "") {

                    return;

                }


                try {

                    const respuesta =
                        await fetch(
                            "http://localhost:3000/mensajes",
                            {
                                method: "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json"
                                },

                                body: JSON.stringify({

                                    usuario:
                                        usuarioActual,

                                    mensaje:
                                        mensaje,

                                    tipoPerfil:
                                        tipoPerfilActual

                                })

                            }
                        );


                    if (!respuesta.ok) {

                        alert(
                            "No se pudo enviar el mensaje."
                        );

                        return;

                    }


                    mensajeInput.value = "";


                    await cargarMensajes();


                } catch (error) {

                    console.error(error);

                    alert(
                        "No se pudo conectar con el servidor."
                    );

                }

            }
        );


        // ---------------------------------------------
        // CARGAR MENSAJES AL ABRIR EL CHAT
        // ---------------------------------------------

        cargarMensajes();

    }

});