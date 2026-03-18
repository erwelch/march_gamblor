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

# Declare build args for Vite (must be passed at build time)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

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
