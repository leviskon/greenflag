import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Доступ к dev-серверу с телефона в той же сети (иначе Next блокирует
  // cross-origin запросы к /_next и клиентский JS не запускается).
  allowedDevOrigins: ["10.247.244.249", "172.30.80.1", "192.168.0.0/16", "10.81.151.249"],
};

export default nextConfig;
