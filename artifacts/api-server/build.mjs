import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/bot/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/index.js',
  external: [],
  logLevel: 'info'
});
