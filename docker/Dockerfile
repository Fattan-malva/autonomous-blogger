FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN mkdir -p images && npm run build

FROM node:20-alpine

RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist/ ./dist/
COPY public/ ./public/
COPY --from=builder /app/images/ ./images/

RUN mkdir -p logs result data

EXPOSE 3000

CMD ["node", "dist/index.js"]
