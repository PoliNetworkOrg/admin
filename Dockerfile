FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Nitro bundles the server and traces its runtime dependencies into .output,
# so the image needs neither node_modules nor package.json.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
COPY --from=builder --chown=node:node /app/.output ./.output
USER node
EXPOSE 3001
CMD ["node", ".output/server/index.mjs"]
