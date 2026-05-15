import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/invoices",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
