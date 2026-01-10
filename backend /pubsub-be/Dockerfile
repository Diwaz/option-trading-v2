FROM oven/bun:1 AS base


WORKDIR /app

COPY . .

RUN bun install 
EXPOSE 8080
CMD ["bun" , "run" , "index.ts"]
