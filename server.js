const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "votaciones_sarmiento",
    password: "panchoso",
    port: 5432
});


// =====================================================
// PÁGINA PRINCIPAL DEL SERVIDOR
// =====================================================

app.get("/", (req, res) => {

    res.send(
        "Servidor de Votaciones Escuela Sarmiento funcionando"
    );

});


// =====================================================
// VER USUARIOS
// =====================================================

app.get("/usuarios", async (req, res) => {

    try {

        const resultado = await pool.query(
            `SELECT id, nombre, apellido, usuario, "tipoPerfil"
             FROM usuarios
             ORDER BY id ASC`
        );

        res.json(resultado.rows);

    } catch (error) {

        console.error(error);

        res.status(500).send(
            "No se pudo conectar con la base de datos."
        );

    }

});


// =====================================================
// CREAR USUARIO
// =====================================================

app.post("/usuarios", async (req, res) => {

    try {

        const {
            nombre,
            apellido,
            usuario,
            contrasena,
            tipoPerfil
        } = req.body;


        const resultado = await pool.query(
            `INSERT INTO usuarios
            (nombre, apellido, usuario, contraseña, "tipoPerfil")
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, nombre, apellido, usuario, "tipoPerfil"`,
            [
                nombre,
                apellido,
                usuario,
                contrasena,
                tipoPerfil
            ]
        );


        res.json({

            mensaje:
                "Usuario creado correctamente",

            usuario:
                resultado.rows[0]

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            mensaje:
                "No se pudo crear el usuario"

        });

    }

});


// =====================================================
// INICIAR SESIÓN
// =====================================================

app.post("/login", async (req, res) => {

    try {

        const {
            usuario,
            contrasena
        } = req.body;


        const resultado = await pool.query(
            `SELECT
                id,
                nombre,
                apellido,
                usuario,
                contraseña,
                "tipoPerfil"
             FROM usuarios
             WHERE usuario = $1
             AND contraseña = $2`,
            [
                usuario,
                contrasena
            ]
        );


        if (resultado.rows.length === 0) {

            return res.status(401).json({

                mensaje:
                    "Usuario o contraseña incorrectos."

            });

        }


        const usuarioEncontrado =
            resultado.rows[0];


        res.json({

            mensaje:
                "Inicio de sesión correcto",

            usuario:
                usuarioEncontrado

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            mensaje:
                "Error al iniciar sesión."

        });

    }

});


// =====================================================
// INICIAR SERVIDOR
// =====================================================
// =====================================================
// CHAT - OBTENER MENSAJES
// =====================================================

app.get("/mensajes", async (req, res) => {

    try {

        const resultado = await pool.query(
            `SELECT
                id,
                usuario,
                mensaje,
                fecha,
                "tipoPerfil"
             FROM mensajes
             ORDER BY id ASC`
        );

        res.json(resultado.rows);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            mensaje: "No se pudieron obtener los mensajes."
        });

    }

});


// =====================================================
// CHAT - GUARDAR MENSAJE
// =====================================================

app.post("/mensajes", async (req, res) => {

    try {

        const {
            usuario,
            mensaje,
            tipoPerfil
        } = req.body;


        const resultado = await pool.query(
            `INSERT INTO mensajes
            (usuario, mensaje, fecha, "tipoPerfil")
            VALUES ($1, $2, NOW(), $3)
            RETURNING
                id,
                usuario,
                mensaje,
                fecha,
                "tipoPerfil"`,
            [
                usuario,
                mensaje,
                tipoPerfil
            ]
        );


        res.json({

            mensaje: "Mensaje guardado correctamente",

            datos: resultado.rows[0]

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            mensaje:
                "No se pudo guardar el mensaje."

        });

    }

});
app.listen(3000, () => {

    console.log(
        "Servidor funcionando en http://localhost:3000"
    );

});