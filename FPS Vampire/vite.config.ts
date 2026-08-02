import { defineConfig } from 'vite';

export default defineConfig({
  // 相对路径，让 dist 可部署到任意子路径（如 GitHub Pages 的 /game-lab/FPS%20Vampire/dist/）
  base: './',
  server: {
    open: true,
  },
  build: {
    target: 'es2022',
  },
});
