FROM oven/bun:1-slim

WORKDIR /app
COPY . .
RUN bun install --production
EXPOSE 12345

CMD ["bun", "run", "index.ts"]
