# ── Stage 1: install ALL deps (dev + prod needed for next build) ──────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC vars must be available at build time
ARG NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}

RUN npm run build

# ── Stage 3: minimal runtime ──────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup -S donorly && adduser -S donorly -G donorly

# Copy only the standalone output produced by next build
COPY --from=builder --chown=donorly:donorly /app/.next/standalone ./
COPY --from=builder --chown=donorly:donorly /app/.next/static ./.next/static
COPY --from=builder --chown=donorly:donorly /app/public ./public

USER donorly
EXPOSE 3000

CMD ["node", "server.js"]
