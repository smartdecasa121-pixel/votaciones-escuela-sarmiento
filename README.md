# Votaciones Escuela Sarmiento

Aplicación web estática para Vercel + Supabase: registro/inicio de sesión con Supabase Auth, perfiles estudiante/admin, propuestas de proyectos con aprobación, votación de un voto por cuenta, resultados agregados y chat en grupos con contraseña.

## Antes de empezar

- Necesitás una cuenta en Supabase y una en Vercel (sus planes gratuitos pueden alcanzar para pruebas escolares, sujetos a límites/cambios del proveedor).
- **No es un sistema de voto secreto certificado ni debe usarse para elecciones oficiales o decisiones de alto riesgo.** El administrador puede moderar proyectos; los resultados agregados son visibles. La votación es una por cuenta, no una verificación de identidad escolar.
- No hay fotos, teléfonos ni correos visibles en los perfiles.
- Nunca publiques una clave `service_role` ni contraseñas de base de datos. La web solo usa la clave pública/anon con RLS activado.

## Paso 1 — Crear Supabase

1. Entrá a https://supabase.com/ y creá un proyecto nuevo.
2. Guardá la contraseña de la base de datos en un gestor seguro; no la agregues al repositorio.
3. En el proyecto, abrí **SQL Editor → New query**.
4. Abrí `supabase-schema.sql` de este ZIP, copiá todo su contenido, pegalo en SQL Editor y pulsá **Run**. Revisá que no aparezcan errores.
5. En **Project Settings → API** (o **Connect**, según la interfaz), copiá la **Project URL** y la clave **publishable/anon**. No copies `service_role` ni `secret key`.
6. En Authentication → URL Configuration, agregá la URL de Vercel cuando ya la tengas. Para desarrollo, agregá también `http://localhost:3000` si vas a probar con un servidor local.
7. Para que el chat se actualice en vivo, en Database → Replication/Realtime habilitá la tabla `public.messages`.

## Paso 2 — Configurar la web

1. Descomprimí el ZIP. La carpeta raíz contiene `index.html`, `app.js`, `style.css`, `supabase-schema.sql`, `README.md` y `vercel.json`.
2. Abrí `app.js` y buscá al principio:

   ```js
   const CONFIG={url:'',anonKey:''};
   ```

3. Pegá la URL y la clave pública que copiaste de Supabase, por ejemplo:

   ```js
   const CONFIG={url:'https://tu-proyecto.supabase.co',anonKey:'tu-clave-publicable'};
   ```

4. Guardá el archivo. No pongas comillas dentro de la clave ni compartas la clave en capturas públicas. La clave pública está diseñada para usarse en el navegador; la seguridad depende de las políticas RLS incluidas en el SQL.

## Paso 3 — Subir a GitHub

1. Abrí tu repositorio `votaciones-escuela-sarmiento` en GitHub.
2. Recomendado: guardá o descargá una copia de seguridad de la versión actual.
3. Subí los archivos de esta carpeta a la raíz del repositorio (no subas la carpeta contenedora dentro de otra carpeta adicional). Deben quedar `index.html`, `app.js`, `style.css`, `supabase-schema.sql`, `README.md`, `vercel.json` en la raíz.
4. Confirmá el commit. No subas archivos `.env`, contraseñas ni claves secretas.

## Paso 4 — Publicar en Vercel

1. Entrá a https://vercel.com/ e iniciá sesión con GitHub.
2. Elegí **Add New → Project** e importá el repositorio.
3. Framework Preset: **Other**. Build Command y Output Directory pueden quedar vacíos/default; es una web estática sin build.
4. Pulsá **Deploy**. Cada nuevo commit a la rama configurada hará un despliegue nuevo.
5. Copiá el dominio asignado, por ejemplo `https://tu-proyecto.vercel.app`.
6. Volvé a Supabase → Authentication → URL Configuration. Poné el dominio como **Site URL** y agregalo a **Redirect URLs**. Guardá los cambios.

## Paso 5 — Crear y habilitar el administrador

1. Abrí la web publicada y registrá tu cuenta con el correo que quieras usar como administradora.
2. En Supabase, abrí **SQL Editor → New query** y ejecutá esta consulta reemplazando el correo por el tuyo:

   ```sql
   update public.profiles p
   set role = 'admin'
   from auth.users u
   where p.user_id = u.id
     and lower(u.email) = lower('TU-CORREO@EJEMPLO.COM');
   ```

3. Cerrá sesión en la web y volvé a ingresar. Vas a ver la sección **Administración**, desde donde podés aprobar o rechazar proyectos.
4. No habilites a nadie como administrador salvo que sea necesario. No se puede cambiar el rol desde la interfaz de estudiante.

## Paso 6 — Probar todo

1. Registrá dos cuentas distintas (usá correos a los que tengas acceso si la confirmación por correo está activada).
2. Ingresá como administradora, aprobá una propuesta.
3. Ingresá como estudiante: revisá Candidatos, Votaciones y emití un voto. Volvé a intentar votar: debe bloquearse por cuenta.
4. Creá un grupo con contraseña desde Grupos; en la segunda cuenta, uníte usando nombre exacto y contraseña; mandá mensajes desde ambas cuentas.
5. Revisá el sitio desde otro dispositivo/navegador y verificá que los datos persisten.

## Qué incluye y límites conocidos

- Inicio, registro e ingreso por Supabase Auth.
- Perfiles con nombre visible y rol estudiante/admin.
- Propuestas pendientes, aprobación/rechazo administrativo y tarjetas de proyectos.
- Voto único por usuario impuesto en PostgreSQL; la interfaz no es la autoridad de seguridad.
- Conteos agregados de votos, sin exponer filas de votos ajenas.
- Grupos privados por contraseña (el navegador calcula SHA-256 y la base solo almacena el hash), membresías y chat persistente.
- Políticas RLS en las tablas y funciones RPC para votar/crear/unirse a grupos.

Importante: esta versión es una base funcional para un proyecto escolar y pruebas supervisadas. No incluye recuperación de contraseña personalizada, verificación de identidad de alumnos, moderación automática de chat, auditoría formal, ni secreto criptográfico/certificación electoral. Revisá mensajes y permisos antes de usarla con menores en producción. Para recuperación de contraseña se puede usar el flujo de Supabase Auth.
