FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY tools/video-processor/processor.js tools/video-processor/server.js ./
USER node
ENV NODE_ENV=production PORT=10000
EXPOSE 10000
CMD ["node", "server.js"]
