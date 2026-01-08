import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';

// Helper to copy directory recursively
function copyDir(src, dest) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }
  const entries = readdirSync(src);
  for (const entry of entries) {
    const srcPath = resolve(src, entry);
    const destPath = resolve(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyDirBeforeWrite: true,
    rollupOptions: {
      input: {
        'background/service-worker': resolve(__dirname, 'src/background/service-worker.js'),
        'manager/manager': resolve(__dirname, 'src/manager/manager.js'),
        'popup/popup': resolve(__dirname, 'src/popup/popup.js'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'shared/[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
    // Don't minify for easier debugging in development
    minify: false,
    sourcemap: true,
  },
  plugins: [
    {
      name: 'copy-extension-files',
      writeBundle() {
        // Copy manifest.json
        copyFileSync(
          resolve(__dirname, 'src/manifest.json'),
          resolve(__dirname, 'dist/manifest.json')
        );

        // Copy HTML files
        copyFileSync(
          resolve(__dirname, 'src/manager/manager.html'),
          resolve(__dirname, 'dist/manager/manager.html')
        );
        copyFileSync(
          resolve(__dirname, 'src/popup/popup.html'),
          resolve(__dirname, 'dist/popup/popup.html')
        );

        // Copy CSS files
        copyFileSync(
          resolve(__dirname, 'src/manager/manager.css'),
          resolve(__dirname, 'dist/manager/manager.css')
        );
        copyFileSync(
          resolve(__dirname, 'src/popup/popup.css'),
          resolve(__dirname, 'dist/popup/popup.css')
        );

        // Copy icons directory
        copyDir(
          resolve(__dirname, 'src/icons'),
          resolve(__dirname, 'dist/icons')
        );
      },
    },
  ],
});
