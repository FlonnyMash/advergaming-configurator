import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dashboardRoot = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(dashboardRoot, "../../../../..");

const isConfiguratorBuild =
  process.env.NEXT_PUBLIC_APP_MODE === "configurator";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  typescript: {
    ignoreBuildErrors: true,
  },
  outputFileTracingExcludes: {
    "*": [
      "**/AppData/**",
      "**/appdata/**",
      "**/Anwendungsdaten/**",
      "**/.pnpm-store/**",
      "**/pnpm/store/**",
    ],
  },
  turbopack: {
    root: monorepoRoot,
  },
  async headers() {
    return [
      {
        source: "/engine/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' http://127.0.0.1:* http://localhost:*;",
          },
        ],
      },
    ];
  },
  transpilePackages: [
    "@mashedgames/shared",
    "@mashedgames/studio-engine",
    "@mashedgames/configurator-engine",
    "@mashedgames/game-engine",
  ],
  webpack: (config, { webpack }) => {
    config.resolve = config.resolve ?? {};
    config.resolve.symlinks = false;
    config.watchOptions = {
      ...(config.watchOptions ?? {}),
      ignored:
        /[\\/](AppData|Anwendungsdaten|\.pnpm-store|node_modules[\\/]\.pnpm)[\\/]/,
    };

    if (isConfiguratorBuild) {
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^@mashedgames\/studio-engine$/,
        }),
      );
      config.resolve.alias = {
        ...config.resolve.alias,
        "@mashedgames/studio-engine": false,
      };
    }
    return config;
  },
};

export default nextConfig;
