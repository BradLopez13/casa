# Lanzamiento de Nido · lo que solo Brad puede hacer

El código está listo para Google Play y la App Store (bloque 15). Todo lo que depende de una
cuenta que aún no existe se lee de una variable o un secreto con nombre fijo (`.env.example` los
lista con una línea cada uno); con las variables vacías, la app y los scripts se comportan como
hoy. Esta lista dice, en orden, qué hacer en cada cuenta, qué variable sale de cada paso, dónde
se pone y cómo se comprueba. No hay que programar nada más.

Dónde se pone cada cosa:

- **EAS (la build):** `eas env:create --name NOMBRE --value … --environment production --environment preview --visibility plaintext|secret`; los archivos, con `--type file`. Las `EXPO_PUBLIC_*` van en texto plano (entran en la app), el resto en secreto.
- **GitHub (los workflows):** _Settings → Secrets and variables → Actions_. Secretos: `EXPO_TOKEN`. Variables (no secretas): `APP_STORE_ID`, `PLAY_URL` (las usa `pages.yml` para la web).
- **Supabase (las funciones):** `pnpm exec supabase secrets set NOMBRE=valor` (proyecto `fyojaslimsgcabfbqdba`); el panel de Auth para los proveedores.
- **`.env.local` del PC:** lo que haga falta para las builds de los móviles de prueba (`pnpm android:release`).

Identificadores, decididos por Brad (DESIGN.md): `com.nidoapp.casa` como `bundleIdentifier` y
`package`; el esquema de los enlaces sigue siendo `casa://`. **Después de publicar no se pueden cambiar.** El nombre que se ve
es «Nido». Versión `1.0.0`; el número de build lo lleva EAS (`autoIncrement`).

---

## 1 · Identificador y dominio

- **Qué:** el identificador es `com.nidoapp.casa` (hecho: en `app.json`, `site/.well-known` y la
  página de la invitación); queda decidir el dominio. Sin dominio todo sigue
  en `https://bradlopez13.github.io/casa` (invitación, política, términos, borrado de cuenta).
- **Si compras dominio:** apúntalo a GitHub Pages (_Settings → Pages → Custom domain_, con los
  registros DNS que GitHub indica) y sigue el paso 5.
- **Coste / tiempo:** 0 € (o ~12 €/año el dominio) · 15 min.
- **Prueba:** la web abre en `https://<dominio>/privacidad/`.

## 2 · Google Play Console (25 $, una vez)

1. Crea la cuenta de desarrollador y la app «Nido» en Play Console (paquete `com.nidoapp.casa`, gratis, con
   compras dentro de la app).
2. **Play App Signing:** acepta que Play firme la app. Apunta la **huella SHA-256 del certificado
   de firma de la app** (_Integridad de la app → Firma de apps_) → va en
   `site/.well-known/assetlinks.json` (paso 5) y la SHA-1 en el cliente OAuth de Android (paso 3).
3. **Cuenta de servicio** para subir builds: en Google Cloud, una cuenta de servicio con permiso
   de _Administrador de versiones_ en Play Console (_Usuarios y permisos → Invitar usuario_, el
   correo de la cuenta de servicio). Descarga su JSON → **`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`**
   (EAS, `--type file`, secreto).
4. **Ficha:** pega `store/es/ficha.md` y `store/en/ficha.md` (título, descripción corta, larga,
   notas), categoría Productividad, icono `assets/images/icon.png` (512×512 se exporta de ahí),
   capturas de `store/screenshots/` (`pnpm store:screenshots`), correo `nido.app.avisos@gmail.com`,
   web `https://bradlopez13.github.io/casa/`, política
   `https://bradlopez13.github.io/casa/privacidad/`.
5. **Seguridad de los datos:** contesta con `store/seguridad-datos.md`. **URL de eliminación de
   cuenta:** `https://bradlopez13.github.io/casa/cuenta/borrar/`.
6. **Prueba interna:** crea la lista con el correo de Segundo (y el tuyo). Copia la URL de
   participación → variable de repositorio **`PLAY_URL`** (así la página de la invitación lleva a
   la prueba mientras no hay ficha pública); al publicar, cámbiala por la URL de la ficha.
7. **Suscripciones:** crea `casas_1` … `casas_10` como dice `store/productos.md`.

- **Coste / tiempo:** 25 $ · 2 h (la verificación de identidad de Google puede tardar días).
- **Prueba:** `eas submit --platform android --profile production --latest` deja la build en la
  prueba interna y Segundo la instala desde el enlace.

## 3 · Firebase y Google (entrar con Google, avisos push)

1. **Firebase:** proyecto «Nido», app Android `com.nidoapp.casa` y app iOS
   `com.nidoapp.casa`. Descarga `google-services.json` → **`GOOGLE_SERVICES_JSON`** (EAS,
   archivo secreto; ya existe en preview) y `GoogleService-Info.plist` →
   **`GOOGLE_SERVICES_PLIST`** (EAS, archivo secreto).
2. **FCM V1 para el push de iOS/Android desde Expo:** en Firebase, _Configuración → Cuentas de
   servicio → Generar nueva clave privada_ y súbela a EAS con `eas credentials` (Android →
   _Google Service Account for FCM V1_).
3. **Clientes OAuth** (Google Cloud → APIs y servicios → Credenciales):
   - Web → **`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`** y su secreto para Supabase.
   - Android: paquete `com.nidoapp.casa` con **dos** huellas SHA-1: la de Play App Signing
     (paso 2) y la del keystore de subida (`eas credentials` la enseña).
     El cliente Android que hubiera para el paquete anterior (`com.bradlopez13.casa`, el de las
     pruebas) no vale: va ligado al paquete. Sin este, «Continuar con Google» falla en Android.
     Para las builds de prueba del PC, añade también la huella del keystore de `pnpm android:release`.
   - iOS: bundle `com.nidoapp.casa` → **`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`** y su esquema
     invertido (`com.googleusercontent.apps.…`) → **`EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`**.
4. **Supabase → Authentication → Providers → Google:** el client id web y su secreto; añade el
   client id de iOS y el de Android en «Authorized Client IDs» (los `id_token` nativos los firman
   ellos).
5. Enciende el botón: **`EXPO_PUBLIC_AUTH_GOOGLE=1`** (EAS y `.env.local`).

- **Coste / tiempo:** 0 € · 1 h.
- **Prueba:** build de preview en el .51, «Continuar con Google» entra con tu cuenta; en
  Ajustes, «Borrar mi cuenta» la borra (crea una de prueba antes).

## 4 · Apple Developer (99 $/año)

1. Cuenta de desarrollador. **`APPLE_TEAM_ID`** (Membership) → EAS (secreto) y Supabase (secreto).
2. **App ID** `com.nidoapp.casa` con _Sign in with Apple_, _Push Notifications_ y
   _Associated Domains_.
3. **Services ID** (p. ej. `com.nidoapp.casa.web`) con _Sign in with Apple_, dominio
   `fyojaslimsgcabfbqdba.supabase.co` y return URL
   `https://fyojaslimsgcabfbqdba.supabase.co/auth/v1/callback`: es el cliente del inicio por
   navegador (Android). Va solo en Supabase (Providers → Apple), con el Team ID y la clave de abajo.
4. **Clave de Sign in with Apple (.p8):** _Keys → +_, con _Sign in with Apple_. **`APPLE_KEY_ID`**
   y el contenido del .p8 → **`APPLE_PRIVATE_KEY`** (Supabase, secretos, para la función
   `revoke-apple`; la clave pegada en una línea con `\n` vale). **`APPLE_BUNDLE_ID`**
   (`com.nidoapp.casa`) → Supabase, secreto. Con los cuatro, borrar la cuenta revoca el token
   de Apple (App Review lo exige).
5. **Clave APNs (.p8)** para los avisos: `eas credentials` → iOS → _Push Notifications_ la sube.
6. **App Store Connect:** crea la app (bundle `com.nidoapp.casa`, SKU `casa`). Su id numérico
   → **`ASC_APP_ID`**; tu Apple ID (correo) → **`APPLE_ID`**; los dos en EAS (secretos). Ficha con
   `store/*/ficha.md`, categoría Productividad, política y términos (`/privacidad/`, `/terminos/`),
   _App Privacy_ con `store/seguridad-datos.md`, capturas de 6,7″ y 6,5″ (cuando haya build de
   iOS). **Suscripciones:** grupo «Casas» con `casas_1` … `casas_10` (`store/productos.md`).
7. **TestFlight:** añade a Segundo como probador interno.
8. Enciende el botón: **`EXPO_PUBLIC_AUTH_APPLE=1`** (EAS y `.env.local`).

- **Coste / tiempo:** 99 $/año · 2 h (más la revisión de la cuenta, 1–2 días).
- **Prueba:** `eas build --platform ios --profile production` compila (sin Mac, en EAS) y
  `eas submit --platform ios` la deja en TestFlight; en un iPhone de prueba, «Continuar con
  Apple» entra, y borrar la cuenta deja de aparecer en _Ajustes → Apple ID → Iniciar sesión con
  Apple_.

## 5 · Dominio propio (App Links y Universal Links)

1. `site/.well-known/assetlinks.json`: la huella SHA-256 de Play App Signing (paso 2).
2. `site/.well-known/apple-app-site-association`: el Team ID en lugar de `EQUIPO`. Apple lo pide
   sin extensión y como `application/json`; si GitHub Pages no lo sirve así, sírvelo desde otro
   alojamiento estático (`site/INVITACIONES.md`).
3. **`EXPO_PUBLIC_INVITE_HOST=<dominio>`** y **`EXPO_PUBLIC_SITE_URL=https://<dominio>`** (EAS y
   `.env.local`). Nueva build.

- **Coste / tiempo:** 0 € · 30 min.
- **Prueba:** `adb shell pm get-app-links com.nidoapp.casa` dice `verified`; el enlace de una
  invitación en WhatsApp abre Nido directamente; el validador de Apple
  (`https://app-site-association.cdn-apple.com/a/v1/<dominio>`) devuelve el archivo.

## 6 · RevenueCat (el cobro)

1. Proyecto «Nido», dos apps (Play y App Store) con sus credenciales de tienda (Play: la cuenta de
   servicio con acceso a la API de Play Developer; App Store: la clave de _In-App Purchase_).
2. Productos `casas_1` … `casas_10` importados de las dos tiendas, un _entitlement_ `casas` y una
   _offering_ `default` con un _package_ por producto (`store/productos.md`).
3. Claves públicas → **`EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`** y **`EXPO_PUBLIC_REVENUECAT_IOS_KEY`**
   (EAS, texto plano).
4. **Webhook:** URL `https://fyojaslimsgcabfbqdba.supabase.co/functions/v1/billing-webhook`,
   cabecera `Authorization: Bearer <secreto>`; el mismo secreto → **`BILLING_WEBHOOK_SECRET`**
   (Supabase). Despliega las funciones: `pnpm exec supabase functions deploy`.
5. **El día de encender el cobro:** `EXPO_PUBLIC_BILLING_ENABLED=true` y
   `EXPO_PUBLIC_LICENSE_PRICE=2,99 €` (el importe real lo pone la tienda) en EAS, nueva build, y en
   la base de datos `select private.enable_billing();` (las casas que había pasan a 14 días de
   prueba). Antes de eso, nada cobra.

- **Coste / tiempo:** 0 € (RevenueCat cobra a partir de 2.500 $/mes de ingresos) · 1 h.
- **Prueba:** sandbox de Play (probadores de licencia) y de App Store (cuenta de Sandbox): una
  compra de `casas_1` deja la casa «Pagada hasta el …» y el webhook registra `INITIAL_PURCHASE`;
  «Restaurar compras» la encuentra; cancelarla en la tienda la deja «Caducada» al fin del periodo.

## 7 · Expo / EAS

1. `eas login` y `eas build:configure` (ya hecho en `eas.json`). Token de acceso →
   **`EXPO_TOKEN`** (secreto de GitHub): `release.yml` compila y envía con él.
2. `eas env:create` de cada variable de arriba por entorno (`preview` y `production`).
3. `eas credentials`: Android deja que EAS genere y guarde el keystore de subida; iOS, los
   certificados de distribución y el perfil de aprovisionamiento (con tu Apple ID).
4. **Sentry:** `SENTRY_AUTH_TOKEN` ya existe (sube los source maps; `release` y `dist` los pone el
   plugin con la versión y el build).

- **Coste / tiempo:** 0 € (el plan gratuito de EAS da 30 builds/mes) · 30 min.
- **Prueba:** `eas build --platform all --profile production` termina en verde para las dos
  plataformas; `git tag v1.0.0 && git push --tags` dispara `release.yml` y deja las builds en la
  prueba interna y TestFlight.

## 8 · Supabase en producción

1. **SMTP propio** para los correos de Auth (el de Supabase tiene límite por hora y remitente
   genérico): Resend, Brevo o similar; en _Authentication → SMTP_, `SMTP_HOST`, `SMTP_USER`,
   `SMTP_PASS` y remitente `nido.app.avisos@gmail.com` (o uno del dominio). Las plantillas ya
   están (`scripts/email`).
2. **URLs:** _Authentication → URL Configuration_: `site_url` = `https://bradlopez13.github.io/casa`
   (o el dominio) y `additional_redirect_urls` con `casa://auth/callback`.
3. **Vault del push:** comprueba que `push_function_url` y `push_webhook_secret` están (lo están si
   el push funciona hoy); para rotar el secreto, cambia el valor en el Vault y el mismo en la
   función (`PUSH_WEBHOOK_SECRET`) en la misma hora.
4. **Vaciar los datos de prueba** (indicación de Brad del 27 oct) y hacer una **copia de
   seguridad** (_Database → Backups_, o `pnpm exec supabase db dump`).
5. Migraciones al día: `pnpm exec supabase db push --linked` (las del bloque 15 ya aplicadas).

- **Coste / tiempo:** 0 € (SMTP gratuito hasta cientos de correos/día) · 1 h.
- **Prueba:** alta de una cuenta nueva recibe el correo de confirmación desde el remitente propio
  en menos de un minuto.

## 9 · La primera versión

`git tag v1.0.0 && git push --tags`: `release.yml` compila las dos plataformas y las envía a la
prueba interna de Play y a TestFlight. Desde ahí, en cada consola, promociona a producción y
envía a revisión. `CHANGELOG.md` queda con la 1.0.0 y la fecha.

---

## Decisiones pendientes para el lanzamiento

- **`expo-updates`** (actualizar el JS sin pasar por la tienda): no está. A favor, arreglar textos
  sin esperar a la revisión; en contra, una pieza más que firmar y una política más que leer.
- **El dominio** (paso 1): sin él, los enlaces abren el navegador antes que Nido.

## Lo que ya está hecho en el código (no hay que tocar)

- Botones de Google y Apple detrás de `EXPO_PUBLIC_AUTH_*`; Google en iOS con su cliente y
  esquema; revocación del token de Apple al borrar la cuenta (`revoke-apple`).
- `app.json` con los permisos justos, sin cifrado no exento, arquitectura nueva.
- Enlaces legales en Ajustes y en el alta; `site/` con política, términos, borrado de cuenta,
  ficha mínima e invitación con App Store y Play (los enlaces los rellena `pages.yml` desde
  `APP_STORE_ID` y `PLAY_URL`).
- `store/` con los textos de ficha, la seguridad de los datos, los productos y las capturas por
  script.
- El cobro: suscripciones por nivel, webhook firmado e idempotente, SDK detrás de la clave,
  restaurar y gestionar.
- `eas.json` con `submit`, `release.yml`, el prebuild de iOS en la CI, `CHANGELOG.md`.
