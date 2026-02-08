import { resolve } from 'path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@preload': resolve('src/preload'),
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
        '@/components': resolve('src/renderer/src/components'),
        '@/hooks': resolve('src/renderer/src/hooks'),
        '@/lib': resolve('src/renderer/src/lib'),
        '@/types': resolve('src/renderer/src/types')
      }
    },
    plugins: [react(), tailwindcss()]
  }
});
