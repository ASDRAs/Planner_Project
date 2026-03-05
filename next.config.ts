import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack과의 충돌을 방지하기 위해 외부 패키지로만 설정합니다.
  serverExternalPackages: ['@xenova/transformers'],
};

export default nextConfig;
