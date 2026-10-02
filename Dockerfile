# ===== Stage 1: Build Frontend =====
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ===== Stage 2: Production Runner =====
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled frontend and server files
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY public ./public

EXPOSE 3000

CMD ["node", "server/index.js"]
