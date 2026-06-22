FROM node:22-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY . .

# Remove onlyBuiltDependencies so all packages can run install scripts.
# This list is a Replit-specific security restriction that breaks Railway builds.
RUN node -e " \
  const fs = require('fs'); \
  const lines = fs.readFileSync('pnpm-workspace.yaml', 'utf8').split('\n'); \
  let skip = false; \
  const out = lines.filter(l => { \
    if (l.startsWith('onlyBuiltDependencies:')) { skip = true; return false; } \
    if (skip && /^  - /.test(l)) return false; \
    skip = false; \
    return true; \
  }); \
  fs.writeFileSync('pnpm-workspace.yaml', out.join('\n')); \
"

RUN pnpm install --no-frozen-lockfile

RUN pnpm --filter @workspace/api-server run build

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
