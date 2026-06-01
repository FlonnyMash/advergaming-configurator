import type { NextConfig } from "next";

const isConfiguratorBuild =
  process.env.NEXT_PUBLIC_APP_MODE === "configurator";

const nextConfig: NextConfig = {
  turbopack: {},
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
