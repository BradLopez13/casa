# Ficha de las tiendas

Lo que se pega en Google Play Console y en App Store Connect, versionado y sin secretos
(bloque 15.5). Los pasos para usarlo están en `LANZAMIENTO.md`.

- `es/ficha.md` y `en/ficha.md`: título, subtítulo, descripciones, palabras clave, notas de la
  versión y categoría, cada uno con su límite. `scripts/store-texts.test.mts` vigila los límites.
- `seguridad-datos.md`: la respuesta a «Seguridad de los datos» de Play y a las etiquetas de
  privacidad de Apple, escrita a partir de lo que la app manda de verdad.
- `productos.md`: los productos de suscripción (`casas_1` … `casas_10`) que hay que crear igual
  en las dos tiendas y en RevenueCat.
- `capturas.md`: qué pantallas lleva la ficha y en qué orden; `pnpm store:screenshots` las genera
  en `screenshots/` con el emulador (`scripts/store-screenshots.sh`). Las de iPhone quedan para
  cuando haya build de iOS.
