FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN mkdir -p images && npm run build

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/images/ ./images/

RUN mkdir -p logs

EXPOSE 3000

CMD ["node", "dist/index.js"]
