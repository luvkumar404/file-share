FROM oven/bun:1.3.14-debian
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends clamav ca-certificates openssl && rm -rf /var/lib/apt/lists/*
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY prisma ./prisma
RUN bun run db:generate
COPY tsconfig.json index.ts ./
COPY src ./src
RUN bun run typecheck
ENV NODE_ENV=production
USER bun
EXPOSE 8000
CMD ["bun", "run", "start"]
