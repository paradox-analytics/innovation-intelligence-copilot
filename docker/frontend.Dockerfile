# =============================================================================
# Innovation Intelligence Copilot — Frontend
# Next.js 15 — Multi-stage build
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Install dependencies
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN \
    if [ -f package-lock.json ]; then npm ci --ignore-scripts; \
    else npm install --ignore-scripts; \
    fi

# ---------------------------------------------------------------------------
# Stage 2: Build the application
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY frontend/ .

# Enable standalone output for minimal production image
ENV NEXT_TELEMETRY_DISABLED=1
RUN \
    if ! grep -q "output.*standalone" next.config.ts 2>/dev/null && \
       ! grep -q "output.*standalone" next.config.js 2>/dev/null; then \
        echo "Warning: standalone output not configured — building normally"; \
    fi && \
    npm run build

# ---------------------------------------------------------------------------
# Stage 3: Production image
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build artifacts if they exist, otherwise fall back to full build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy standalone server if it was generated
COPY --from=builder /app/.next/standalone ./  2>/dev/null || true
COPY --from=builder /app/.next/static ./.next/static  2>/dev/null || true

USER nextjs

EXPOSE 3000

ENV PORT=3000 \
    HOSTNAME="0.0.0.0"

# Use standalone server if available, otherwise use next start
CMD ["sh", "-c", "if [ -f server.js ]; then node server.js; else npm start; fi"]
