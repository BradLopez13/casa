# Casa

App móvil para llevar una casa compartida entre varias personas, para iOS y Android con una sola base de código (Expo y Supabase). Responde a una pregunta: **¿cómo se hace que un grupo comparta datos en una app móvil sin que el cliente pueda escribir donde no debe?**

[![CI](https://github.com/BradLopez13/casa/actions/workflows/ci.yml/badge.svg)](https://github.com/BradLopez13/casa/actions/workflows/ci.yml)

## Por qué existe

Tres cosas que se pueden comprobar: que la seguridad de una app con Supabase vive en la base de datos (RLS y RPC con tests pgTAP), que un flujo con dos personas (crear un hogar, invitar, unirse, salir) funciona de punta a punta, y que ese flujo se prueba en un emulador en cada PR.

## Estado

Fases 1–2 hechas: cuentas con email y contraseña, hogares, invitaciones por enlace, listado de miembros, expulsar, transferir la propiedad, salir y borrar el hogar. Siguientes: tareas, compra en tiempo real, notificaciones, borrado de cuenta y publicación en TestFlight y Google Play.

## Stack

- Expo SDK 57, React Native 0.86, Expo Router, TypeScript con `strict` y `noUncheckedIndexedAccess`.
- Supabase: Auth, PostgreSQL con RLS y funciones `security definer`. Cliente `@supabase/supabase-js` con TanStack Query y Zod.
- Vitest para el cliente, pgTAP para la base de datos, Maestro para el E2E.
- Textos de interfaz en español, siempre a través de `t()`. Identificadores de código y de base de datos en inglés.

## Decisiones de arquitectura

**Las escrituras solo pasan por RPC.** `households`, `household_members` y `household_invites` no admiten INSERT, UPDATE ni DELETE desde el cliente: se revoca todo a `anon` y `authenticated` y solo se concede lo necesario, columna a columna. Las operaciones (`create_household`, `create_invite`, `accept_invite`, `revoke_invite`, `leave_household`, `remove_member`, `transfer_ownership`, `delete_household`) son funciones `plpgsql security definer` con `search_path = ''`, sin `execute` para `public` ni `anon`. Así las reglas (quién puede expulsar, qué pasa con el último propietario) están en un único sitio que el cliente no puede saltarse. Los errores son una lista cerrada de códigos: `NOT_AUTHENTICATED`, `INVALID_NAME`, `ALREADY_IN_HOUSEHOLD`, `INVITE_INVALID`, `INVITE_EXPIRED`, `NOT_A_MEMBER`, `NOT_OWNER`, `OWNER_MUST_TRANSFER` y `CANNOT_REMOVE_SELF`; el cliente añade `NETWORK` y `UNKNOWN` y los traduce a texto en un solo mapa.

**RLS por pertenencia al hogar.** Las policies de lectura no repiten subconsultas: llaman a funciones auxiliares del esquema `private` (`is_member`, `is_owner`, `shares_household`), que la API de Supabase no expone.

**Un hogar activo por usuario.** Un índice único parcial sobre `household_members (user_id) where left_at is null` lo garantiza en la base de datos, no en el cliente. El modelo admite varios hogares más adelante; en v1 el índice lo impide.

**Un solo propietario.** Otro índice único parcial, sobre `household_id where role = 'owner' and left_at is null`. Si quedan otros miembros, el último propietario no puede salir sin transferir antes (`OWNER_MUST_TRANSFER`); si está solo, salir borra el hogar.

**Invitaciones.** El token son 24 bytes aleatorios en hexadecimal. La base de datos guarda solo su SHA-256, así que una copia de la tabla no sirve para unirse a ningún hogar. Caduca a los 7 días, se usa una sola vez y se puede revocar. `accept_invite` no consume nada hasta haber comprobado que el usuario puede unirse: si falla, la invitación sigue valiendo para otra persona.

**Orden de bloqueos.** Las RPC que pueden coincidir con un borrado del hogar bloquean primero su fila y después las de invitación o miembro: `accept_invite` la toma compartida (`for share`) y las de administración (salir, expulsar, transferir, borrar), exclusiva. `create_invite` y `revoke_invite` no toman el bloqueo del hogar: solo tocan la fila de la invitación. Con un orden fijo, dos operaciones simultáneas (aceptar una invitación mientras se borra el hogar) esperan en fila en vez de interbloquearse.

**Sesión troceada en SecureStore.** `expo-secure-store` limita cada valor a unos 2048 bytes y una sesión de Supabase es mayor. El adaptador (`data/supabase/chunked-storage.ts`) la parte en trozos de 1800 unidades UTF-16 con un contador aparte, y nunca corta un par sustituto por la mitad, para que cada trozo sea UTF-16 válido al guardarlo como UTF-8. La clave `service_role` no llega nunca al cliente.

**La invitación pendiente sobrevive al registro.** Si alguien abre el enlace sin sesión, el token se guarda en SecureStore y se le lleva a iniciar sesión o crear cuenta. Al entrar, la app muestra la pantalla de la invitación en lugar del onboarding. Un enlace mal formado se rechaza y no sustituye al guardado.

**El E2E corre en Android en CI.** Los runners de macOS de GitHub no tienen Docker, y el E2E necesita un Supabase local. Los mismos flujos Maestro valen para iOS (se localizan elementos por `testID` o texto, sin pasos propios de una plataforma) pero en CI solo se ejecutan en Android. iOS se cubre con `expo export --platform ios` en CI y con prueba manual en un iPhone físico con Expo Go.

## Tests

Resultado de `pnpm db:test` contra el Supabase local:

```
$ supabase test db
supabase/tests/households.test.sql ........ ok
supabase/tests/invites.test.sql ........... ok
supabase/tests/membership_admin.test.sql .. ok
supabase/tests/profiles.test.sql .......... ok
All tests successful.
Files=4, Tests=124,  1 wallclock secs ( 0.04 usr  0.01 sys +  0.04 cusr  0.03 csys =  0.12 CPU)
Result: PASS
```

| Nivel            | Qué prueba                                                                                                                                           | Comando                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Cliente          | 70 tests de Vitest: trozos de sesión, mapa de errores, esquemas, enlaces de invitación, redirecciones según sesión y hogar                           | `pnpm test`                     |
| Base de datos    | 124 aserciones pgTAP: `households` 24, `invites` 42, `membership_admin` 49, `profiles` 9. Permisos por rol, RLS, índices únicos, errores de cada RPC | `pnpm db:start && pnpm db:test` |
| De punta a punta | Tres flujos Maestro en un emulador de Android                                                                                                        | `pnpm e2e`                      |

Los tres flujos de `e2e/`:

- `sign-up-create-household.yaml`: registro, crear el hogar, copiar el enlace de invitación, revocarlo y borrar el hogar.
- `join-with-invite.yaml`: registro, una invitación caducada muestra su error, un enlace válido pegado entra en el hogar, la lista de miembros muestra a Ana y a Bob sin acciones de propietario, y Bob sale.
- `invite-link-signed-out.yaml`: abrir un enlace de invitación sin sesión, crear la cuenta, llegar a la pantalla de la invitación (no al onboarding) y aceptarla.

### CI

Tres jobs en `.github/workflows/ci.yml`, sin secretos ni proyecto en la nube:

- `app`: Prettier, ESLint con `--max-warnings 0`, typecheck, Vitest y `expo export` para Android e iOS.
- `db`: levanta Postgres con el CLI de Supabase, pasa pgTAP y falla si los tipos generados (`data/supabase/database.types.ts`) no están al día.
- `e2e-android`: depende de los dos anteriores. Levanta Supabase local, carga los datos de prueba, compila un APK de release y ejecuta los flujos Maestro en un emulador de API 34.

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
pnpm e2e:fixtures                   # crea a Ana y Berta, su hogar y las invitaciones de prueba (usa psql)
pnpm e2e:env                        # escribe .env.e2e con la clave local y 10.0.2.2 como host
set -a; . ./.env.e2e; set +a
E2E=1 pnpm expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=x86_64 && cd ..
adb install android/app/build/outputs/apk/release/app-release.apk
maestro test -e SUPABASE_KEY="$EXPO_PUBLIC_SUPABASE_KEY" e2e/   # un script del flujo de tiempo real usa la clave
```

## Ejecutar la app

Requiere Node (versión en `.nvmrc`) y pnpm. Con un proyecto de Supabase propio, aplica las migraciones con `pnpm supabase db push`, desactiva la confirmación de email en Auth y crea el `.env`:

```bash
cp .env.example .env     # EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_KEY (clave publishable)
pnpm install
pnpm expo start
```

En `.env` solo van la URL y la clave publishable; nunca la `service_role`.

Con Expo Go, el móvil y el ordenador deben estar en la misma red Wi-Fi. Los enlaces de invitación en Expo Go son de tipo `exp://`; si el sistema no los abre en la app, la pantalla de onboarding tiene un campo para pegar el enlace. En una build propia el esquema es `casa://invite?token=…`.

## Flujo de Git

Cada tarea se hace en una rama `task-NN-<slug>` creada desde `main`. Se abre un PR, se espera a que pasen `app`, `db` y `e2e-android`, y se integra con rebase, de modo que `main` queda lineal y conserva los commits de cada tarea. Los commits siguen Conventional Commits en inglés (`feat:`, `fix:`, `test:`, `ci:`, `docs:`, `refactor:`, con ámbito opcional como `feat(db):`) y cada uno pasa `pnpm check`: el test y el código que lo hace pasar van juntos.
