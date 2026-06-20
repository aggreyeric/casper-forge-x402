# FORGE demo server image — Node.js x402 facilitator + RWA agent.
FROM node:22-slim

WORKDIR /app

# Install deps first for layer caching
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy built artifacts + contract WASM
COPY dist ./dist
COPY contract/target/wasm32-unknown-unknown/release/x402_settlement.wasm ./contract/
COPY scripts ./scripts

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Lightweight healthcheck against the free health endpoint
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/demo/server.js"]
