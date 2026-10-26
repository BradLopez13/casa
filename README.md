# Nido

**Nido · La casa, en equipo.** El repositorio conserva el nombre técnico `casa`. La app ya usa el icono, el splash, el nombre y la paleta de Nido.

App móvil para llevar una casa compartida entre varias personas, para iOS y Android con una sola base de código (Expo y Supabase). Responde a una pregunta: **¿cómo se hace que un grupo comparta datos en una app móvil sin que el cliente pueda escribir donde no debe?**

[![CI](https://github.com/BradLopez13/casa/actions/workflows/ci.yml/badge.svg)](https://github.com/BradLopez13/casa/actions/workflows/ci.yml)

## Por qué existe

Tres cosas que se pueden comprobar: que la seguridad de una app con Supabase vive en la base de datos (RLS y RPC con tests pgTAP), que un flujo con dos personas (crear un hogar, invitar, unirse, salir) funciona de punta a punta, y que ese flujo se prueba en un emulador en cada PR.

## Estado

Fases 1–8 hechas:

- Cuentas con email y contraseña, hogares, invitaciones por enlace, miembros, expulsar, transferir la propiedad, salir y borrar el hogar.
- Tareas con estancia, responsable y fecha, pantallas Hoy y Tareas, y completado optimista.
- Tareas recurrentes (cada día, cada N días, días de la semana, mensual) y plantillas para un hogar vacío.
- Lista de la compra compartida con sugerencias, que funciona sin conexión, y tiempo real en compra y tareas.
- Borrado de la propia cuenta, «hoy» según la zona horaria de cada persona y recordatorios locales de mañana y tarde.
- Avisos push con la app cerrada cuando te asignan una tarea o alguien se une al hogar.
- Interfaz responsive: gira en móvil y tablet, dos paneles desde 840 dp y raíl lateral.
- Varias casas por persona (la suya y la de su madre, por ejemplo) y una licencia mensual por casa, preparada y apagada.

Siguiente: publicación en TestFlight y en las pruebas internas de Google Play.

## Stack

- Expo SDK 57, React Native 0.86, Expo Router, TypeScript con `strict` y `noUncheckedIndexedAccess`.
- Supabase: Auth, PostgreSQL con RLS y funciones `security definer`. Cliente `@supabase/supabase-js` con TanStack Query y Zod.
- Vitest para el cliente, pgTAP para la base de datos, Maestro para el E2E.
- Textos de interfaz en español, siempre a través de `t()`. Identificadores de código y de base de datos en inglés.

## Decisiones de arquitectura

**Las escrituras solo pasan por RPC.** `households`, `household_members` y `household_invites` no admiten INSERT, UPDATE ni DELETE desde el cliente: se revoca todo a `anon` y `authenticated` y solo se concede lo necesario, columna a columna. Las operaciones (`create_household`, `create_invite`, `accept_invite`, `revoke_invite`, `leave_household`, `remove_member`, `transfer_ownership`, `delete_household`) son funciones `plpgsql security definer` con `search_path = ''`, sin `execute` para `public` ni `anon`. Así las reglas (quién puede expulsar, qué pasa con el último propietario) están en un único sitio que el cliente no puede saltarse. Los errores son una lista cerrada de códigos: `NOT_AUTHENTICATED`, `INVALID_NAME`, `ALREADY_A_MEMBER`, `INVITE_INVALID`, `INVITE_EXPIRED`, `NOT_A_MEMBER`, `NOT_OWNER`, `OWNER_MUST_TRANSFER`, `CANNOT_REMOVE_SELF`, `LICENSE_REQUIRED` y `BILLING_DISABLED`; el cliente añade `NETWORK` y `UNKNOWN` y los traduce a texto en un solo mapa.

**RLS por pertenencia al hogar.** Las policies de lectura no repiten subconsultas: llaman a funciones auxiliares del esquema `private` (`is_member`, `is_owner`, `shares_household`), que la API de Supabase no expone.

**Una persona, varias casas.** Un índice único parcial sobre `household_members (household_id, user_id) where left_at is null` impide estar dos veces en la misma casa; en casas distintas, las que haga falta. Todo lo demás ya era por casa (tareas, compra, estancias, invitaciones, difusión por `household:{id}`), así que una persona en dos casas ve lo de cada una y nada de una tercera, y quien comparte una casa con ella no ve la otra. `my_households()` es lo que lista la app. La casa que se ve es una preferencia del móvil (`casa-active-household-<usuario>` en AsyncStorage), no del servidor; las colas sin red y la caché van por casa, así que cambiar de casa no toca lo que la otra tenga pendiente. `delete_account` exige pasar antes cada casa compartida que lleves y las nombra en el detalle de `OWNER_MUST_TRANSFER`.

**Una licencia por casa, con el cobro apagado.** Cada casa tiene su licencia mensual en `household_licenses` (`complimentary`, `trial`, `active`, `past_due`, `canceled`), la paga quien la crea (`paid_by`) y se queda con la casa si se traspasa. Nadie la escribe desde el cliente: la crea un trigger al crear la casa y la cambia `apply_billing_event`, que solo puede llamar el servicio (la Edge Function `billing-webhook`, con la cabecera `Authorization` de RevenueCat). El interruptor es `private.app_settings.billing_enabled` (en la base, `false`; se cambia con SQL) y en la app `EXPO_PUBLIC_BILLING_ENABLED` (si ofrece «Pagar la licencia»; el SDK del proveedor no está instalado) y `EXPO_PUBLIC_LICENSE_PRICE` (el importe, nunca en el código). Con el cobro apagado toda casa está licenciada, `create_household` crea la licencia como `complimentary`, `start_household_checkout` responde `BILLING_DISABLED` y el webhook contesta 200 sin tocar nada. Encendido, una casa nueva empieza 14 días de prueba, y las RPC que escriben tareas, compra o invitaciones consultan `private.household_is_licensed` y responden `LICENSE_REQUIRED` cuando la licencia caducó (con 7 días de gracia para `past_due`). Leer, salir, traspasar y borrar no se bloquean nunca.

**Un solo propietario.** Otro índice único parcial, sobre `household_id where role = 'owner' and left_at is null`. Si quedan otros miembros, el último propietario no puede salir sin transferir antes (`OWNER_MUST_TRANSFER`); si está solo, salir borra el hogar.

**Invitaciones.** El token son 24 bytes aleatorios en hexadecimal. La base de datos guarda solo su SHA-256, así que una copia de la tabla no sirve para unirse a ningún hogar. Caduca a los 7 días, se usa una sola vez y se puede revocar. `accept_invite` no consume nada hasta haber comprobado que el usuario puede unirse: si falla, la invitación sigue valiendo para otra persona.

**Orden de bloqueos.** Las RPC que pueden coincidir con un borrado del hogar bloquean primero su fila y después las de invitación o miembro: `accept_invite` la toma compartida (`for share`) y las de administración (salir, expulsar, transferir, borrar), exclusiva. `create_invite` y `revoke_invite` no toman el bloqueo del hogar: solo tocan la fila de la invitación. Con un orden fijo, dos operaciones simultáneas (aceptar una invitación mientras se borra el hogar) esperan en fila en vez de interbloquearse.

**Sesión troceada en SecureStore.** `expo-secure-store` limita cada valor a unos 2048 bytes y una sesión de Supabase es mayor. El adaptador (`data/supabase/chunked-storage.ts`) la parte en trozos de 1800 unidades UTF-16 con un contador aparte, y nunca corta un par sustituto por la mitad, para que cada trozo sea UTF-16 válido al guardarlo como UTF-8. La clave `service_role` no llega nunca al cliente.

**La invitación pendiente sobrevive al registro.** Si alguien abre el enlace sin sesión, el token se guarda en SecureStore y se le lleva a iniciar sesión o crear cuenta. Al entrar, la app muestra la pantalla de la invitación en lugar del onboarding. Un enlace mal formado se rechaza y no sustituye al guardado.

**El E2E corre en Android en CI.** Los runners de macOS de GitHub no tienen Docker, y el E2E necesita un Supabase local. Los mismos flujos Maestro valen para iOS (se localizan elementos por `testID` o texto, sin pasos propios de una plataforma) pero en CI solo se ejecutan en Android. iOS se cubre con `expo export --platform ios` en CI y con prueba manual en un iPhone físico con Expo Go.

## Tests

Resultado de `pnpm db:test` contra el Supabase local (28 archivos, uno por área: hogares y varias casas, invitaciones, miembros, licencias, tareas y recurrencia, compra, difusión en tiempo real, avisos, cuenta y el guard de permisos):

```
$ supabase test db
All tests successful.
Files=28, Tests=701
Result: PASS
```

| Nivel            | Qué prueba                                                                                                                                                                                     | Comando                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Cliente          | 1353 tests de Vitest en 125 archivos: dominio (recurrencia, fechas, alta rápida, normalización), caché y cola offline, Realtime, mapas de errores, esquemas, maquetación y reglas de DESIGN.md | `pnpm test`                     |
| Render           | 15 tests de render (`*.test.tsx`) con react-native-web en jsdom: estados de la lista de tareas, Hoy y el formulario de tarea                                                                   | `pnpm test`                     |
| Base de datos    | 701 aserciones pgTAP en 28 archivos: permisos por rol, RLS, índices únicos, varias casas, licencias, errores de cada RPC, difusión por sentencia y grants                                      | `pnpm db:start && pnpm db:test` |
| De punta a punta | 19 flujos Maestro en un emulador de Android, más uno en inglés                                                                                                                                 | `pnpm e2e`                      |

Los flujos de `e2e/` cubren el acceso (registro, entrar, recuperar la contraseña, ver la contraseña, volver), el hogar (crearlo, unirse con un enlace con y sin sesión, quitar a alguien, pasar el hogar), las tareas (crear y completar, repetir, editar, saltar y borrar, tareas típicas), la compra (lista, tiempo real con otra persona y cola sin conexión), varias casas (crear otra, cambiar, invitar, la licencia y unirse estando en dos), los ajustes de avisos, borrar la cuenta, el giro de pantalla y el idioma inglés (`e2e/locale/`). Cada flujo entra con su propio usuario de `supabase/e2e/fixtures.sql`, así que no comparten estado.

Los tests de render dibujan los componentes con `react-native-web`; los módulos nativos (iconos, área segura, Reanimated, gestos, SVG, cripto, el cliente de Supabase) se simulan en `vitest.render.setup.tsx` y los datos llegan de un `QueryClient` rellenado por el test.

### CI

Corre en los PR hacia `main` y en cada push a `main`, sin secretos ni proyecto en la nube:

- `app`: Prettier, ESLint con `--max-warnings 0`, typecheck, Vitest y `expo export` para Android e iOS.
- `db`: levanta Postgres con el CLI de Supabase, pasa pgTAP y falla si los tipos generados (`data/supabase/database.types.ts`) no están al día.
- `build-apk`: corre a la vez que los dos anteriores y compila una sola vez el APK de release para el E2E, con la clave del Supabase local.
- `e2e-android (1)`, `(2)` y `(3)`: dependen de los tres anteriores. Cada uno levanta su Supabase local, carga los datos de prueba y ejecuta un tercio de los flujos Maestro (`scripts/e2e-shard.sh`) en un emulador de API 34.
- Si un cambio solo toca `docs/`, Markdown o tests unitarios, `build-apk` y `e2e-android` no corren.

### Comprobaciones en local

```bash
pnpm check                          # Prettier, ESLint, typecheck y Vitest
pnpm db:start && pnpm db:test       # pgTAP; necesita Docker
pnpm db:types                       # regenera data/supabase/database.types.ts
```

E2E en local. Necesita Android Studio (emulador y `adb`), Docker y `psql`:

```bash
pnpm supabase start
pnpm db:reset                       # las invitaciones son de un solo uso: reinicia antes de cada ejecución
pnpm e2e:fixtures                   # crea los usuarios de prueba, sus hogares y las invitaciones (usa psql)
pnpm e2e:env                        # escribe .env.e2e con la clave local y 10.0.2.2 como host
set -a; . ./.env.e2e; set +a
E2E=1 pnpm expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=x86_64 && cd ..
adb install android/app/build/outputs/apk/release/app-release.apk
pnpm e2e                            # maestro test con la clave de .env.e2e, que usa el flujo de tiempo real
```

## Ejecutar la app

Requiere Node (versión en `.nvmrc`) y pnpm. Con un proyecto de Supabase propio, aplica las migraciones con `pnpm supabase db push`, desactiva la confirmación de email en Auth y crea el `.env`:

```bash
cp .env.example .env     # EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_KEY (clave publishable)
pnpm install
pnpm expo start
```

En `.env` solo van la URL y la clave publishable; nunca la `service_role`.

### Builds de EAS

Los perfiles `preview` (APK interno para testers) y `production` leen sus variables del entorno de EAS del mismo nombre. `app.config.js` para la build si falta alguna (`scripts/build-env.js`):

| Variable                                               | Tipo en EAS                                     |
| ------------------------------------------------------ | ----------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` | texto plano                                     |
| `EXPO_PUBLIC_SENTRY_DSN`                               | texto plano (el DSN es público)                 |
| `SENTRY_AUTH_TOKEN`                                    | secreta; sube los source maps a Sentry          |
| `GOOGLE_SERVICES_JSON`                                 | archivo secreto (`google-services.json` de FCM) |

```bash
eas env:create --name EXPO_PUBLIC_SENTRY_DSN --value <dsn> --environment preview --environment production --visibility plaintext
eas env:create --name SENTRY_AUTH_TOKEN --value <token> --environment preview --environment production --visibility secret
eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment preview --environment production --visibility secret
```

Sentry solo informa desde builds de release con DSN: sin datos personales, sin grabación de sesión y con trazas en el 20 % de las sesiones. En CI la subida de source maps está apagada (`SENTRY_DISABLE_AUTO_UPLOAD`).

Con Expo Go, el móvil y el ordenador deben estar en la misma red Wi-Fi. Los enlaces de invitación en Expo Go son de tipo `exp://`; si el sistema no los abre en la app, la pantalla de onboarding tiene un campo para pegar el enlace. En una build propia el esquema es `casa://invite?token=…`.

## Flujo de Git

Cada tarea se hace en una rama `task-NN-<slug>` creada desde `main`. Se abre un PR, se espera a que pasen `app`, `db` y `e2e-android`, y se integra con rebase, de modo que `main` queda lineal y conserva los commits de cada tarea. Los commits siguen Conventional Commits en inglés (`feat:`, `fix:`, `test:`, `ci:`, `docs:`, `refactor:`, con ámbito opcional como `feat(db):`) y cada uno pasa `pnpm check`: el test y el código que lo hace pasar van juntos.
