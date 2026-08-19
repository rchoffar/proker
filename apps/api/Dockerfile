# bookworm-slim (glibc) plutôt qu'alpine : better-sqlite3 installe son binaire
# précompilé sans musl. Le toolchain (python3/make/g++) n'est présent que dans le
# stage de build, en secours si le binaire précompilé est indisponible — le runtime
# reçoit node_modules déjà construit (npm prune --omit=dev), sans réinstaller.
# Build stage — deps + compile TS
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# Runtime stage — prod deps only, copiés depuis le build
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
