# Seguridad de los datos (Play) y etiquetas de privacidad (Apple)

Escrito a partir de lo que la app manda de verdad (bloque 15.5). Si la app empieza a mandar
algo nuevo, esto y la política de privacidad cambian en el mismo PR.

## Qué sale del móvil, a dónde y por qué

| Dato                                               | A dónde                    | Para qué                           | Obligatorio | Cifrado en tránsito | Se puede borrar             |
| -------------------------------------------------- | -------------------------- | ---------------------------------- | ----------- | ------------------- | --------------------------- |
| Correo electrónico                                 | Supabase (auth)            | La cuenta, entrar, recuperar clave | Sí          | Sí (HTTPS)          | Sí, «Borrar mi cuenta»      |
| Nombre que eliges mostrar                          | Supabase                   | Que la casa sepa quién es quién    | Sí          | Sí                  | Sí                          |
| Identificador de Google o Apple (si entras así)    | Supabase (auth)            | Entrar                             | No          | Sí                  | Sí                          |
| Tareas, compra, nombre de la casa, invitaciones    | Supabase                   | Compartirlo con la casa            | Sí          | Sí                  | Sí (la casa, a los 30 días) |
| Zona horaria e idioma                              | Supabase                   | Recordatorios a su hora, correos   | Sí          | Sí                  | Sí                          |
| Token de notificaciones (Expo Push)                | Supabase → Expo → FCM/APNs | Avisos de la casa                  | No          | Sí                  | Sí, al borrar la cuenta     |
| Informes de errores (versión, modelo, dónde falló) | Sentry                     | Arreglar fallos                    | No          | Sí                  | Se borran solos (retención) |
| Rendimiento (1 de cada 5 sesiones)                 | Sentry                     | Ver qué va lento                   | No          | Sí                  | Se borran solos             |
| Suscripción (estado, fechas, id de compra)         | RevenueCat → Supabase      | Saber si la licencia está al día   | No          | Sí                  | Cuando la tienda la cierra  |

Nada de esto se usa para publicidad ni se vende. No hay SDK de analítica ni de anuncios. No se
leen contactos, ubicación, fotos, cámara ni micrófono. El portapapeles solo se lee en Android,
al abrir «Unirme con un enlace», para rellenar la invitación copiada, y no sale del móvil.

## Google Play · «Seguridad de los datos»

- ¿Recopila o comparte datos del usuario? **Sí.**
- ¿Se cifran en tránsito? **Sí.**
- ¿Hay forma de pedir que se borren? **Sí** (en la app, «Ajustes → Borrar mi cuenta», y en
  https://bradlopez13.github.io/casa/cuenta/borrar/).
- Tipos de datos:
  - **Información personal:** nombre, dirección de correo. Recopilados, no compartidos. Fines:
    funcionamiento de la app, gestión de la cuenta. Obligatorios.
  - **Identificadores de usuario:** el id de la cuenta (y el de Google/Apple si entra así).
    Recopilados, no compartidos. Fines: funcionamiento de la app, gestión de la cuenta.
  - **Mensajes / otro contenido generado por el usuario:** tareas, lista de la compra, nombre de
    la casa. Recopilados, no compartidos (se ven dentro de la casa). Fines: funcionamiento.
  - **Información de la app y rendimiento:** registros de fallos, diagnósticos. Recopilados, no
    compartidos (Sentry trata por cuenta nuestra). Opcionales. Fines: analítica (rendimiento),
    estabilidad.
  - **Compras:** historial de compras (la suscripción). Recopilados, no compartidos (RevenueCat
    trata por cuenta nuestra). Opcionales. Fines: funcionamiento de la app.
  - **Identificadores de dispositivo:** no (el token push es por instalación y no identifica el
    dispositivo fuera del envío de avisos; Play lo cuenta dentro de «Información de la app»).
- Prácticas de seguridad: cifrado en tránsito; sin copia de seguridad del sistema (`allowBackup:
false`); sesión en el almacén seguro del móvil.

## App Store · «App Privacy»

- **Data Linked to You** (vinculados a la identidad): Contact Info → Email Address, Name;
  User Content → Other User Content (tareas y compra); Identifiers → User ID; Purchases →
  Purchase History.
- **Data Not Linked to You**: Diagnostics → Crash Data, Performance Data (Sentry recibe un
  id interno, no el correo ni el nombre).
- **Data Used to Track You**: ninguno. No hay seguimiento entre apps ni webs; no se pide
  App Tracking Transparency.
- Fines por tipo: App Functionality para todo; Analytics solo para Diagnostics.

## Permisos declarados

Android: `INTERNET`, `VIBRATE`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED` (recordatorios
programados tras reiniciar). Bloqueados aunque una librería los pida: `SYSTEM_ALERT_WINDOW`,
`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`. iOS: notificaciones (se piden al activar
los recordatorios), Sign in with Apple, dominios asociados (invitaciones). Sin cámara, fotos,
ubicación, contactos ni micrófono. `ITSAppUsesNonExemptEncryption = false` (solo HTTPS).
