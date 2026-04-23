# Resumen Técnico y Guía de Uso: Frontend MIPRES Wizard

Este documento resume la arquitectura, el flujo de trabajo y una **guía paso a paso de uso** del frontend desarrollado para consumir la API de MIPRES a través del backend Node.js intermedio.

---

## 🏗️ Arquitectura y Tecnologías Relevantes

El proyecto está construido sobre un stack moderno y ligero para garantizar velocidad y mantenibilidad:

- **Framework Core:** React optimizado y empaquetado con Vite.
- **Lenguaje:** TypeScript estricto.
- **Manejo de Estado Central:** Context API de React puro.
- **Peticiones HTTP:** Axios apuntando **solo** al backend local (por seguridad).
- **Estilos:** Vanilla CSS (`index.css`), diseñado sin dependencias externas cumpliendo parámetros minimalistas.

## 🧠 Flujo de Datos y Context API (`WizardContext.tsx`)

El corazón reactivo de la aplicación vive en `WizardContext`. Este archivo mantiene sincronizado lo que sucede en la pantalla con lo que exige la base de datos de los 5 pasos obligatorios.
1. **`proceso`**: El objeto JSON que representa el trámite actual. Aquí se almacenan (pero no se pueden modificar manualmente) los IDs devueltos por SISPRO.
2. **`currentStep`**: Número (del 1 al 5) que le indica al switch del `WizardContainer` qué fragmento de la UI mostrar en pantalla.
3. **`updateProcesoFromDb()`**: Función que reemplaza toda la variable `proceso` con la información nueva traída desde la base de datos, auto-calculando a qué página debe ir el usuario en base al último envío exitoso.

---

## 🚀 Guía Práctica de Uso (Cómo Usar la Interfaz)

### Preparación Previa
Asegúrate de tener corriendo tanto el backend (puerto `3001` con conexión a MySQL) como el frontend (puerto `5173`).
1. Abre tu navegador y dirígete a `http://localhost:5173`.
2. Verás en pantalla el **MIPRES Integración Wizard** arrancando en el **Paso 1**.

### Ejecución del Trámite Paso a Paso

**👉 Paso 1: Autenticación (Generar Token)**
- **Qué hacer:** Ingresa el **NIT** de tu IPS/Farmacia y el **Token Base** proporcionado por SISPRO.
- **Comportamiento:** Al pulsar el botón, el sistema valida las credenciales y, en background, crea un código de trazabilidad único en la Base de Datos Local (`id_local`).
- **Navegación:** La pantalla avanzará sola al Paso 2 si las credenciales son válidas.

**👉 Paso 2: Direccionamiento**
- **Qué hacer:** Rellena el largo formulario clínico. Ingresa el *Número de Prescripción*, el tipo de tecnología, e identificadores del paciente. Notarás que el campo "NIT Proveedor" está bloqueado y autocompletado con el NIT del Paso 1.
- **Comportamiento:** Envía los datos. SISPRO te devolverá silenciosamente un `IdDireccionamiento`. El sistema te avisa del éxito y lo oculta en memoria.
- **Navegación:** Avanzas automáticamente al Paso 3.

**👉 Paso 3: Programación**
- **Qué hacer:** Selecciona la fecha estipulada para entregar el insumo al usuario y la cantidad a entregar, brindando además tu código de sede (habilitación).
- **Comportamiento:** *Magia oculta:* El frontend le inyecta al envío el `IdDireccionamiento` secreto que obtuvimos en el paso 2 sin que tengas que teclearlo. SISPRO responde con un `IdProgramacion`.
- **Navegación:** Avanzas al Paso 4.

**👉 Paso 4: Entrega Efectiva**
- **Qué hacer:** Declara al sistema cuándo se entregó físicamente la medicina al paciente (Fecha de entrega, Código CUM o CUP y si la entrega fue total o parcial).
- **Comportamiento:** *Magia oculta:* El frontend ahora enhebra el ID de direccionamiento Y el ID de programación juntos en esta petición. Se sella en el registro nacional y retorna un `IdEntrega`.
- **Navegación:** Avanza al Paso 5.

**👉 Paso 5: Reporte de Facturación / Entrega**
- **Qué hacer:** Confirma si la entrega fue completa y digita el "Valor Facturado" (en pesos COP).
- **Comportamiento:** Se notifica a SISPRO. Si todo va bien, la pantalla cambia radicalmente para mostrar un gran letrero verde 🎉 con la trazabilidad completa del paciente, exhibiendo lado a lado los 4 IDs generados imposibles de replicar.

### 🛡️ Utilidad Clave: "Resumir o Continuar un Proceso"
¿Qué pasa si tienes que irte a la mitad del Paso 3 y al volver, la computadora se reinició?
1. Abre de nuevo el navegador (Estarás en el vacío Paso 1).
2. En la parte superior derecha hay una caja de texto que dice **"Resumir ID..."**.
3. Ingresa allí el número del "**Proceso Local**" que estabas trabajando (ej: `15`) y presiona el botón **Cargar**.
4. ¡El Context API hace un barrido a la Base de Datos, se da cuenta de que ese ID se quedó trabado en el estado `PROGRAMADO` (Paso 3) y mágicamente restaura la pantalla directa a la fase de **Entrega (Paso 4)**, bloqueando todos los datos pasados para que retomes donde te quedaste!
