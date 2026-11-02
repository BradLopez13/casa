# Invitaciones con enlace https (lo que falta para la opción A)

Decisión de Brad (1 y 2 de noviembre de 2026): hasta el lanzamiento, la invitación lleva un enlace
https a esta web en GitHub Pages, `https://bradlopez13.github.io/casa/invite/?token=…`, con los dos
pasos en el mensaje por si no se abre. La página abre Nido con un toque (o lleva a Google Play).
Sin dominio propio no hay App Links: el enlace abre primero el navegador. Lo de abajo es para
pasar a un dominio propio, donde el enlace abre Nido directamente (A).

## Lo que ya está hecho

- `site/invite/index.html`: la página del enlace sin la app («Te invitan a una casa en Nido»,
  «Abrir la invitación en Nido», Google Play y los dos pasos). La página no manda el token a
  ningún sitio: solo va al enlace que abre Nido (`intent://` en Android, con la tienda como
  respaldo; `casa://` en el resto). No carga nada de fuera. El servidor que la sirve sí ve la
  consulta en sus registros; con `#token=` no la vería, si algún día se quiere.
- En iOS la página solo enlaza Google Play: falta el enlace de la App Store cuando exista.
- `site/.well-known/assetlinks.json` y `site/.well-known/apple-app-site-association`: plantillas.
- `buildInviteUrl` (`features/households/invite-link.ts`) construye
  `https://<EXPO_PUBLIC_INVITE_HOST>/invite?token=…` cuando la variable existe.
- `app.config.js` declara entonces los App Links de Android (`intentFilters` con `autoVerify`
  para `https://<host>/invite`) y los Universal Links de iOS (`associatedDomains`).
- `parseInviteToken` ya acepta el enlace https, el `casa://` y el mensaje entero pegado.

## El día que haya dominio

1. Apuntar el dominio a GitHub Pages (dominio propio en _Settings → Pages_ del repositorio, que
   publica `site/` en su raíz) o a otro alojamiento estático con `site/`.
2. En `site/.well-known/assetlinks.json`, la huella SHA-256 de la clave con la que Google Play
   firma la app (Play Console → Integridad de la app → Firma de apps), no la del keystore local.
3. En `apple-app-site-association`, el Team ID de Apple en lugar de `EQUIPO`. Apple lo quiere sin
   extensión y con `Content-Type: application/json`, y GitHub Pages no deja fijar la cabecera de
   un archivo sin extensión: si el dominio va a Pages, comprobar que Apple lo acepta o servirlo
   desde otro alojamiento.
   `EXPO_PUBLIC_INVITE_HOST` es solo el dominio (sin ruta): App Links y Universal Links se
   verifican en la raíz del dominio, así que `bradlopez13.github.io/casa` no vale para eso.
4. `EXPO_PUBLIC_INVITE_HOST=<dominio>` en los perfiles de EAS (`eas.json`) y en `.env.local`.
5. Nueva build: Android verifica el dominio al instalar
   (`adb shell pm get-app-links com.bradlopez13.casa` debe decir `verified`).
6. Probar: el enlace en WhatsApp abre Nido con la app instalada, y la página sin ella.
