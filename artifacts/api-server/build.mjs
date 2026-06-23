import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/bot/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/index.mjs',
  external: ['pino', 'pino-pretty', 'thread-stream'],
  logLevel: 'info'
});
