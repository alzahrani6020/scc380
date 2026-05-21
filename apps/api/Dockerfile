# Multi-stage build for NestJS API
FROM node:20-alpine AS builder

RUN npm install -g pnpm

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma Client
RUN cd packages/database && npx prisma generate

# Build packages
RUN pnpm --filter @scc/database build
RUN pnpm --filter @scc/auth build
RUN pnpm --filter @scc/types build
RUN pnpm --filter @scc/utils build

# Build API
RUN pnpm --filter @scc/api build

# Production image
FROM node:20-alpine AS runner

RUN npm install -g pnpm

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001

CMD ["node", "apps/api/dist/main"]
