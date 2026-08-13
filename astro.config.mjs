import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  security: {
    allowedDomains: [
      { protocol: 'https', hostname: 'gene-sophen.cloud' },
      { protocol: 'https', hostname: 'www.gene-sophen.cloud' }
    ]
  },
  server: {
    host: '127.0.0.1',
    port: 4321
  }
});
