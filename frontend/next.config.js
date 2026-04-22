/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/media/:path*",
        destination:
          (process.env.MINIO_PUBLIC_URL ||
            "http://minio:9000/blogify-media") + "/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
