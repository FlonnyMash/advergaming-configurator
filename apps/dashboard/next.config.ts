import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  LOCAL_DEV_DIST_DIR,
  shouldUseLocalDevCache,
} from "./scripts/local-dev-cache-dir.mjs";

const dashboardRoot = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(dashboardRoot, "../..");

const isConfiguratorBuild =
  process.env.NEXT_PUBLIC_APP_MODE === "configurator";

const devDistDir =
  process.env.NODE_ENV === "development" &&
  shouldUseLocalDevCache(monorepoRoot)
    ? LOCAL_DEV_DIST_DIR
    : undefined;

const nextConfig: NextConfig = {
  ...(devDistDir ? { distDir: devDistDir } : {}),
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
    const logoCacheHeaders =
      process.env.NODE_ENV === "development"
        ? [
            {
              source: "/mashed-games-logo.png",
              headers: [
                {
                  key: "Cache-Control",
                  value: "no-store, must-revalidate",
                },
              ],
            },
          ]
        : [];

    return [
      ...logoCacheHeaders,
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
