# 📦 DateBox Admin Backoffice (`admin-datebox`)

Consola web centralizada para el equipo operativo, de moderación y administración de **DateBox**.

---

## 🎯 Razón de Ser y Propósito

Anteriormente, las herramientas administrativas convivían de manera oculta dentro de `business-datebox`. Sin embargo, los casos de uso y las audiencias son completamente diferentes:

- **`business-datebox` (B2B):** Portal exclusivo para dueños de locales gastronómicos y de entretenimiento para gestionar sus sucursales, ver reservas grupales y crear promociones.
- **`admin-datebox` (Backoffice Operativo):** Plataforma interna para los fundadores y administradores de DateBox. Su objetivo es gobernar la plataforma, moderar reclamos comerciales, auditar suscripciones de Mercado Pago, supervisar pipelines masivos de eventos (ETL) y gestionar el catálogo completo.

---

## 🏗️ Arquitectura y Tecnologías

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router, React 19).
- **Estilos y UI:** [Tailwind CSS](https://tailwindcss.com/) con tema adaptativo (Dark Mode y Light Mode inspirados en el diseño minimalista de la app móvil y landing de DateBox).
- **Gestión de Estado:** [Zustand](https://github.com/pmndrs/zustand) (`useAuthStore`, `useUIStore`).
- **Data Fetching y Caché:** [TanStack React Query](https://tanstack.com/query/latest) con cliente de API centralizado y fallback resiliente a base de datos.
- **Backend & Autenticación:** [Supabase](https://supabase.com/) (`auth.users` + tabla `public.admins`) y servidor API en Cloudflare Workers (`apps/api`).
- **Iconos:** [Lucide React](https://lucide.dev/).

---

## 🧭 Secciones del Panel

### 1. 📊 Centro de Control (`/`)
Tablero principal con métricas clave (KPIs) en vivo:
- Cantidad de reclamos comerciales pendientes de moderación.
- Total de suscripciones recurrentes activas en Mercado Pago e ingresos mensuales estimados (MRR).
- Volumen total de eventos y lugares disponibles en el catálogo.
- Acceso directo a pipelines ETL y alta rápida de contenidos.

### 2. 🏪 Solicitudes de Comercios (`/claims`)
Módulo de moderación y verificación de legitimación comercial:
- Listado filtrable de reclamos de locales presentados por comerciantes.
- Visualización de datos fiscales (CUIT, razón social, titular, teléfono, email).
- Apertura segura de comprobantes PDF adjuntos mediante enlaces firmados temporales de Supabase Storage.
- Acciones de **Aprobación** (vincula automáticamente el local al comerciante) o **Rechazo**.

### 3. 💳 Suscripciones y Pagos (`/subscriptions`)
Control financiero y planes comerciales:
- Monitoreo de suscripciones de comercios integradas con Mercado Pago (estados `authorized`, `pending`, `paused`, `cancelled`).
- Métricas financieras consolidadas en pesos argentinos (ARS).
- Creador y editor de nuevos **Planes de Suscripción** (límites de sucursales, cupos mensuales de eventos y porcentaje de boost en el algoritmo de recomendación por IA).

### 4. 🧭 Catálogo de Lugares y Eventos (`/catalog`)
Explorador unificado de la base de datos de actividades:
- Filtros multifacéticos por tipo (lugares permanentes vs eventos temporales), categorías gastronómicas/culturales y estado de visibilidad.
- Buscador en tiempo real por título, dirección o etiquetas.
- Switch rápido para activar o desactivar eventos directamente en la plataforma.

### 5. 🗄️ ETL y Cargas Masivas (`/etl`)
Centro de comando para el pipeline de ingesta automatizada de eventos externos:
- Monitoreo de fuentes activas (scrapers de agendas culturales, turismo, portales de eventos).
- Ejecución manual de sincronizaciones.
- Terminal interactiva para visualización de logs de ingesta y detección de errores.
- Importador masivo de eventos mediante carga de archivos estructurados en formato JSON.

### 6. 📅 Alta Directa de Eventos (`/events/new`)
Formulario para carga manual de nuevas experiencias:
- Carga de títulos, descripción, categoría y dirección con geolocalización (latitud y longitud).
- Configuración de horarios de apertura, precios de entradas y URLs de imágenes.
- Asignación de etiquetas para el motor de recomendación.

### 7. 🛡️ Administradores (`/admins`)
Gestión de accesos y seguridad:
- Listado de usuarios con rol administrativo concedido en `public.admins`.
- Asignación de nuevos administradores mediante su `user_id` de Supabase Auth.

---

## 🔐 Seguridad y Cuentas de Usuario

El acceso al panel está blindado mediante el componente `AdminGuard`:
- La autenticación utiliza Supabase Auth.
- La autorización verifica la existencia del `user_id` dentro de la tabla `public.admins`.
- **Independencia de perfiles:** Un usuario puede tener su cuenta habitual de la app móvil con su correo personal y a la vez tener rol administrativo en el Backoffice sin interferir ni mezclar perfiles comerciales o de usuario estándar.

---

## 🔄 Sincronización Automática con GitHub Actions

El proyecto está configurado para desarrollarse dentro del monorepo `datebox` y sincronizarse automáticamente a un repositorio independiente (`Asymmetric-Devs/datebox-admin`) para despliegues aislados:

- **Workflow:** [`.github/workflows/sync-admin.yml`](../../.github/workflows/sync-admin.yml)
- Se activa en cada commit/push a `main` que modifique la carpeta `apps/admin-datebox/**`.
- También admite ejecución manual desde la pestaña **Actions** de GitHub (*workflow_dispatch*).

---

## 💻 Desarrollo Local

```bash
# Navegar al directorio de la app
cd apps/admin-datebox

# Instalar dependencias (desde la raíz del monorepo)
npm install

# Iniciar servidor de desarrollo en puerto 3002
npm run dev

# Compilar para producción
npm run build
```
