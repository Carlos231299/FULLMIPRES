# 🩺 MIPRES Wizard + Dashboard - Documentación Técnica

Este repositorio contiene una aplicación de escritorio completa (Electron + React) para la automatización y gestión de trámites ante **SISPRO/MIPRES**. Ha evolucionado de un simple asistente a un **Dashboard integral** con gestión de sesiones, navegación lateral y módulos independientes por tecnología.

---

## 🚀 Tecnologías Core

- **Framework:** [React 19](https://react.dev/) + [React Router 7](https://reactrouter.com/)
- **Empaquetador:** [Vite](https://vitejs.dev/)
- **Lenguaje:** [TypeScript](https://www.typescriptlang.org/)
- **Contenedor Desktop:** [Electron](https://www.electronjs.org/)
- **Estilos:** Vanilla CSS (Diseño Custom Premium)
- **Estado Global:** Context API (AuthContext para sesión y WizardContext para progreso)
- **Peticiones API:** Axios con interceptores para inyección de credenciales.

---

## 🔐 Seguridad y Sesión

La aplicación implementa un sistema de autenticación robusto basado en las credenciales de SISPRO:

1.  **Login:** El usuario ingresa su NIT y Token Base. El sistema valida contra el endpoint de Token de SISPRO y genera una sesión local.
2.  **Persistencia:** La sesión se guarda en `localStorage` con trazabilidad de tiempos.
3.  **Expiración Automática:**
    *   **Inactividad:** La sesión se cierra tras **1 hora** sin detectar movimiento del mouse o teclado.
    *   **Tiempo Máximo:** La sesión expira obligatoriamente a las **10 horas** del login inicial.
4.  **Interceptor Axios:** Todas las peticiones inyectan automáticamente el NIT y Token desde el almacenamiento local.

---

## 🧠 Estructura y Navegación

El proyecto utiliza un `Sidebar` lateral para acceder a los diferentes módulos:

*   **🧙 Asistente (Wizard):** Flujo guiado de 4 pasos (Direccionamiento ➔ Programación ➔ Entrega ➔ Reporte). El paso 1 (Token) ha sido integrado en el Login.
*   **Módulos Independientes (UI Inteligente):**
    *   **📋 Direccionamiento:** Consulta estado por prescripción. Permite crear o anular.
    *   **📅 Programación:** Consulta y gestión de fechas/cantidades.
    *   **📦 Entrega:** Reporte técnico de medicamentos.
    *   **📊 Reporte Entrega:** Cierre financiero del trámite.
    *   **🚫 No Direccionamiento:** Gestión de tecnologías no direccionables.
*   **📁 Carga Masiva (Excel):** Procesamiento masivo de registros con reporte de salida.

---

## 🛠️ Guía de Desarrollo

### Requisitos Previos
- Node.js (v18+)
- Backend MIPRES corriendo (Puerto 3001)
- MySQL configurado

### Instalación
```bash
npm install
```

### Ejecución (Modo Integrado)
Este comando lanza el Backend, el Frontend y el contenedor de Electron simultáneamente:
```bash
npm run electron:dev
```

### Credenciales de Prueba (Modo Dev)
Para facilitar el testeo, el login viene pre-rellenado con:
*   **NIT:** `57304482`
*   **Token Base:** `7619D137-4D48-4348-BA74-93A7A196F880`

---

## 📂 Organización de Archivos

```
src/
├── components/          # Layout, Sidebar, WizardContainer y Stepper
│   ├── steps/           # Pasos 2, 3, 4 y 5 del Wizard
│   └── BatchMIPRES      # Módulo Excel
├── context/             # AuthContext (Sesión) y WizardContext (Progreso)
├── pages/               # Páginas de Login y Módulos Standalone
├── router/              # Definición de rutas y ProtectedRoute
└── services/            # Cliente API (api.ts) con interceptores
```

---
*Desarrollado para la automatización eficiente de procesos de salud gestionados por SISPRO.*
