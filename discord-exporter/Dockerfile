FROM oven/bun:1-distroless

WORKDIR /app
COPY . .
RUN bun install --production
EXPOSE 12345

CMD ["bun", "run", "index.ts"]
