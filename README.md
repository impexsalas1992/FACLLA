# Control de Ventas & Gastos con IA (AGRICARL PERU)

Aplicación web integral para el registro, control fiscal y gestión financiera de comprobantes de ventas, compras/gastos con escáner IA Gemini, decodificador SUNAT QR, integración con Google Sheets/Drive y reportes ejecutivos.

---

## 🚀 Opciones de Exportación y Despliegue (Hosting)

### 1. Exportar el Código desde Google AI Studio
1. En la barra superior derecha de Google AI Studio, haz clic en el menú de **Opciones / Ajustes** o el botón **Export**.
2. Puedes elegir:
   - **Export to GitHub**: Para clonar o sincronizar directamente con un repositorio de GitHub.
   - **Download as ZIP**: Para descargar todos los archivos del proyecto a tu computadora en un archivo comprimido.

---

## 🛠️ Ejecución Local

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno (crear .env a partir de .env.example)
cp .env.example .env
# Añade tu GEMINI_API_KEY en el archivo .env

# 3. Iniciar en modo desarrollo
npm run dev

# 4. Compilar para producción
npm run build

# 5. Iniciar servidor de producción
npm start
```

---

## 🌐 Guías para Hospedar (Hosting)

### Opción A: Render (Recomendado - Gratis / Bajo Costo)
1. Sube tu proyecto a GitHub.
2. Ingresa a [render.com](https://render.com) y crea un **Web Service**.
3. Conecta tu repositorio de GitHub.
4. Configura:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. En la sección **Environment Variables**, añade:
   - `GEMINI_API_KEY` = Tu API Key de Google Gemini
   - `NODE_ENV` = `production`
6. Haz clic en **Create Web Service**.

---

### Opción B: Railway
1. Ingresa a [railway.app](https://railway.app) y haz clic en **New Project** -> **Deploy from GitHub repo**.
2. Railway detectará automáticamente el archivo `Dockerfile` o `package.json`.
3. En la pestaña **Variables**, añade `GEMINI_API_KEY`.
4. Railway generará un dominio HTTPS listo para usar.

---

### Opción C: Google Cloud Run (o cualquier servicio Docker)
La aplicación incluye un `Dockerfile` optimizado y multi-etapa:

```bash
# Construir la imagen Docker
docker build -t control-ventas-gastos:latest .

# Ejecutar el contenedor localmente o en tu servidor
docker run -d -p 3000:3000 -e GEMINI_API_KEY="tu_api_key" control-ventas-gastos:latest
```

---

### Opción D: Servidor VPS Propio (Ubuntu / Debian / Nginx)
1. Clona el repositorio en tu servidor.
2. Instala Node.js 20+: `npm install && npm run build`.
3. Usa PM2 para mantenerlo siempre activo:
   ```bash
   npm install -g pm2
   pm2 start dist/server.cjs --name "ventas-gastos-app"
   pm2 save
   pm2 startup
   ```
4. Configura Nginx como proxy inverso hacia `http://localhost:3000`.

---

## 🔑 Variables de Entorno

| Variable | Descripción | Requerido |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Clave API de Google AI Studio / Gemini para análisis de comprobantes e informes | Sí |
| `PORT` | Puerto de escucha del servidor (por defecto 3000) | No |
| `NODE_ENV` | Entorno de ejecución (`development` o `production`) | No |

---

## ✨ Características Principales
- 🧾 **Escaneo Inteligente de Comprobantes**: Extracción automática con IA de Facturas, Boletas, Notas y Recibos por Honorarios.
- 📊 **Cálculo Tributario SUNAT**: Débito fiscal, crédito fiscal, IGV por pagar y detracciones.
- 📂 **Sincronización con Google Sheets & Drive**: Respaldo bidireccional en tiempo real.
- 📱 **Diseño Adaptativo**: Vistas optimizadas para PC, Tabletas y Teléfonos Móviles.
