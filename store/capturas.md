# Capturas de la ficha

Se generan con `pnpm store:screenshots` (`scripts/store-screenshots.sh`): el script vuelve a
cargar los fixtures, y Maestro recorre la build E2E en el emulador con la cuenta de ficha
(`demo@e2e.dev`, «Casa de ejemplo», con tareas y compra puestas), retira primero las pistas de
primer uso y guarda cada pantalla en `store/screenshots/<perfil>/`.
Perfiles: `phone` (6,7″, 1080×2400) y `tablet` (10″, 1600×2560, horizontal), cada uno en claro
y en oscuro. Las de iPhone (6,7″ y 6,5″ obligatorias en App Store Connect) quedan para cuando
haya build de iOS: el mismo flujo vale con `maestro test` sobre el simulador.

Orden en la ficha (las dos tiendas enseñan las primeras tres sin desplazar):

1. `01-hoy`: Hoy con «Te tocan 2.», «Y 1 de días anteriores», y la bandeja de hechas.
2. `02-tareas`: Tareas › Todas, agrupadas por día, con los imanes de quién.
3. `03-compra`: la lista de la compra con cantidades y «lo de siempre».
4. `04-tarea`: la hoja de una tarea con sus imanes (quién, cuándo, se repite).
5. `05-sin-red`: Hoy sin red: la banda «Sin conexión. Mostrando lo último.» y una nota «Sin enviar».
6. `06-ajustes`: Ajustes con las casas y los recordatorios.

Cada captura sale en claro (`-claro.png`) y en oscuro (`-oscuro.png`). Google Play pide entre 2 y
8 por tipo de dispositivo, en JPEG o PNG de 24 bits, de 320 a 3840 px por lado y relación 16:9 o
9:16; los tamaños de arriba cumplen. App Store Connect pide 1290×2796 (6,7″) y 1242×2688 (6,5″)
o deja reutilizar las de 6,7″.
