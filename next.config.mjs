/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * Proxy all /backend/* requests to the Spring Boot API.
   * BACKEND_URL is set at runtime on Cloud Run — no baked-in URL, no CORS.
   */
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_URL ?? "http://localhost:8080";
    return [
      {
        source: "/backend/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
