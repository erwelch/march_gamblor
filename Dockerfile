# ---- Build stage ----
FROM node:20-slim AS build

WORKDIR /app

# Copy package files first for layer caching
COPY package.json ./
COPY client/package.json client/
COPY server/package.json server/

# Install all deps  native bindings resolve correctly on Linux here
RUN npm install --prefix client && npm install --prefix server

# Copy source code
COPY client/ client/
COPY server/ server/

# Build client (vite) and server (tsc)
RUN npm run build --prefix client && npm run build --prefix server

# ---- Production stage ----
FROM node:20-slim AS production

WORKDIR /app

COPY package.json ./
COPY server/package.json server/
RUN npm install --prefix server --omit=dev

# Copy built artifacts only
COPY --from=build /app/client/dist client/dist
COPY --from=build /app/server/dist server/dist

EXPOSE 3000

CMD ["node", "server/dist/index.js"]
