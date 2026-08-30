/** @type {import('next').NextConfig} */
// 作为 game-lab 仓库子项目部署在 https://xanthanl.github.io/game-lab/golden-wind/out/
// 构建产物按现状提交在 golden-wind/out，basePath 必须与 Pages 上的实际路径逐段一致，
// 否则 out/_next 下的 JS/CSS 会全部 404。改完源码需重新 npm run build 再提交。
const nextConfig = {
  output: 'export',
  basePath: '/game-lab/golden-wind/out',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
