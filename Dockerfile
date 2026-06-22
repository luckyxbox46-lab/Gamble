FROM node:22-alpine
WORKDIR /app
COPY artifacts/api-server/dist ./dist
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
