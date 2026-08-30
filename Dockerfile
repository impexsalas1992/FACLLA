# Etapa de compilación y ejecución
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar manifiestos de dependencias
COPY package*.json ./

# Instalar dependencias completas
RUN npm install

# Copiar código fuente
COPY . .

# Compilar frontend y bundle del servidor de producción
RUN npm run build

# Imagen final de producción ligera
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copiar dependencias de producción y artefactos compilados
COPY package*.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Iniciar servidor Node.js
CMD ["node", "dist/server.cjs"]
