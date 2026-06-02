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
  turbopack: {
    root: monorepoRoot,
  },
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: [
    "@advergaming/shared",
    "@advergaming/studio-engine",
    "@advergaming/configurator-engine",
    "@advergaming/game-engine",
  ],
  webpack: (config, { webpack }) => {
    if (isConfiguratorBuild) {
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^@advergaming\/studio-engine$/,
        }),
      );
      config.resolve = config.resolve ?? {};
      config.resolve.alias = {
        ...config.resolve.alias,
        "@advergaming/studio-engine": false,
      };
    }
    return config;
  },
};

export default nextConfig;
