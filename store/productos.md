# Productos de suscripción

El modelo decidido el 27 de octubre de 2026 (DESIGN.md, «El cobro que permiten las tiendas»):
**un grupo de suscripción por persona con un nivel por número de casas**, de modo que «una
licencia por casa» se mantiene en lo que paga la persona. Quien paga `casas_n` cubre hasta n
casas que lleva; al bajar de nivel la app pregunta cuál suelta. El precio es n × el importe
base que marque Brad en cada tienda (la app enseña `EXPO_PUBLIC_LICENSE_PRICE` como importe por
casa; el real lo pone la tienda). Los identificadores viven en `features/households/billing.ts`
(`LICENSE_PRODUCTS`) y `features/households/billing.test.ts` los fija: cambiarlos aquí sin
cambiarlos allí rompe el test.

| Nivel | Identificador de producto (Play y App Store) | Casas cubiertas | Precio       |
| ----- | -------------------------------------------- | --------------- | ------------ |
| 1     | `casas_1`                                    | 1               | 1 × importe  |
| 2     | `casas_2`                                    | 2               | 2 × importe  |
| 3     | `casas_3`                                    | 3               | 3 × importe  |
| 4     | `casas_4`                                    | 4               | 4 × importe  |
| 5     | `casas_5`                                    | 5               | 5 × importe  |
| 6     | `casas_6`                                    | 6               | 6 × importe  |
| 7     | `casas_7`                                    | 7               | 7 × importe  |
| 8     | `casas_8`                                    | 8               | 8 × importe  |
| 9     | `casas_9`                                    | 9               | 9 × importe  |
| 10    | `casas_10`                                   | 10              | 10 × importe |

## En Google Play Console

Monetizar → Productos → Suscripciones: una suscripción por nivel con el id de la tabla, un plan
base mensual con renovación automática (`mensual`), sin oferta de prueba en la tienda (la prueba
de 14 días la da el servidor, por persona: `private.enable_billing()`). Grupo: no hace falta en
Play; el cambio de nivel lo gestiona RevenueCat.

## En App Store Connect

Monetización → Suscripciones → grupo «Casas» (un solo grupo, para que cambiar de nivel sea un
cambio de plan y no una segunda suscripción). Dentro, un producto por nivel con el id de la
tabla, duración 1 mes, el nivel 10 el más alto del grupo y el 1 el más bajo. Sin oferta
introductoria.

## En RevenueCat

Un proyecto, dos apps (Play y App Store), un _entitlement_ `casas` y una _offering_ `default`
con diez _packages_ (`casas_1` … `casas_10`), cada uno con el producto de cada tienda. El
`app_user_id` es el `auth.uid()` de Supabase. Webhook a
`https://fyojaslimsgcabfbqdba.supabase.co/functions/v1/billing-webhook` con la cabecera
`Authorization: Bearer <BILLING_WEBHOOK_SECRET>`.
