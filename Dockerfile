# ==============================================================================
# HomeCartel Marketing Calendar UI - Zoho Catalyst AppSail Dockerfile
# Production Container: Next.js Standalone Runner
# ==============================================================================

# Stage 1: Build Next.js standalone application
FROM node:20-alpine AS builder
WORKDIR /app

# Enable legacy peer deps if needed
ENV CI=true

COPY package*.json ./
RUN npm install

COPY . .

# Run production Next.js build
RUN npm run build

# Stage 2: Production runtime image (Ultra-lightweight)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy standalone build artifacts
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/data ./data

# Expose container port
EXPOSE 3000

# Support dynamic Zoho Catalyst AppSail port ($X_ZOHO_CATALYST_LISTEN_PORT) with fallback to $PORT or 3000
CMD ["sh", "-c", "PORT=${X_ZOHO_CATALYST_LISTEN_PORT:-${PORT:-3000}} node server.js"]
