FROM node:22-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY . .

# Remove onlyBuiltDependencies restriction so all packages can run
# their install scripts in Railway's trusted build environment
RUN node -e " \
  const fs = require('fs'); \
  let c = fs.readFileSync('pnpm-workspace.yaml', 'utf8'); \
  c = c.replace(/^onlyBuiltDependencies:[^\n]*\n(  - [^\n]*\n)*/m, ''); \
  fs.writeFileSync('pnpm-workspace.yaml', c); \
"

RUN pnpm install --no-frozen-lockfile

RUN pnpm --filter @workspace/api-server run build

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
