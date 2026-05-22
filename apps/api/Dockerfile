FROM node:20-alpine AS builder
RUN npm install -g pnpm@9
WORKDIR /app
ENV NODE_OPTIONS=--max-old-space-size=400
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN pnpm install --frozen-lockfile --prefer-offline
RUN cd packages/database && npx prisma generate
RUN pnpm exec turbo run build --filter=@scc/api --no-daemon

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
RUN npm install -g pnpm@9
WORKDIR /app
ENV NODE_ENV=production PORT=3001
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/turbo.json ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["sh", "-c", "cd packages/database && npx prisma db push && cd ../../apps/api && node dist/main.js"]
