import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const monorepoRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const isConfiguratorBuild =
  process.env.NEXT_PUBLIC_APP_MODE === "configurator";

const nextConfig: NextConfig = {
  output: "standalone",
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
    "@advergaming/shared",
    "@advergaming/studio-engine",
    "@advergaming/configurator-engine",
    "@advergaming/game-engine",
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
          resourceRegExp: /^@advergaming\/studio-engine$/,
        }),
      );
      config.resolve.alias = {
        ...config.resolve.alias,
        "@advergaming/studio-engine": false,
      };
    }
    return config;
  },
};

export default nextConfig;
