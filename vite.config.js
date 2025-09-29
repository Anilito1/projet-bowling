import { defineConfig } from 'vite';

// Dynamically set base for GitHub Pages (project site) except user/org root repos.
// If repository is user.github.io, base should be '/'. Otherwise '/<repo>/' so assets resolve.
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] || '';
const isUserSite = repo.endsWith('.github.io');

export default defineConfig({
  base: isUserSite ? '/' : (repo ? `/${repo}/` : '/'),
  build: {
    outDir: 'dist',
    sourcemap: false,
  }
});
