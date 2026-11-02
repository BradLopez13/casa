# Invitaciones con enlace https (lo que falta para la opción A)

Decisión de Brad del 1 de noviembre de 2026: hasta el lanzamiento, la invitación se comparte con
el mensaje en dos pasos y el enlace `casa://invite?token=…` en su propia línea (B). Todo lo de
abajo está preparado para pasar a un enlace https que abre Nido si está instalada y, si no, una
página con la tienda y los pasos (A).

## Lo que ya está hecho

- `site/invite/index.html`: la página del enlace sin la app («Te invitan a una casa en Nido»,
  «Abrir la invitación en Nido», Google Play y los dos pasos). El token no sale de la página: solo
  va al enlace que abre Nido (`intent://` en Android, con la tienda como respaldo; `casa://` en el
  resto). No carga nada de fuera.
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
3. En `apple-app-site-association`, el Team ID de Apple en lugar de `EQUIPO`. Se sirve sin
   extensión y con `Content-Type: application/json`.
4. `EXPO_PUBLIC_INVITE_HOST=<dominio>` en los perfiles de EAS (`eas.json`) y en `.env.local`.
5. Nueva build: Android verifica el dominio al instalar
   (`adb shell pm get-app-links com.bradlopez13.casa` debe decir `verified`).
6. Probar: el enlace en WhatsApp abre Nido con la app instalada, y la página sin ella.
