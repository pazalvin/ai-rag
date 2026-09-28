# Build context: repository root (see docker-compose.yml)
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/ts/package.json ./apps/ts/
COPY packages/ui/package.json ./packages/ui/
RUN npm ci --workspace api --include-workspace-root=false --omit=dev

COPY apps/ts/src ./apps/ts/src
COPY data/guidelines ./data/guidelines
COPY data/rules ./data/rules

WORKDIR /app/apps/ts
EXPOSE 3001
CMD ["npx", "tsx", "src/index.ts"]
