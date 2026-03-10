import path from "path";
import { config as loadEnv } from "dotenv";

// Monorepo: root .env yükle (AUTH0_SECRET vb.)
loadEnv({ path: path.resolve(process.cwd(), "../../.env") });

// Auth0 v3 edge middleware beklenen env fallback'leri
if (!process.env.AUTH0_BASE_URL && process.env.APP_BASE_URL) {
  process.env.AUTH0_BASE_URL = process.env.APP_BASE_URL;
}
if (!process.env.AUTH0_ISSUER_BASE_URL && process.env.AUTH0_DOMAIN) {
  const d = process.env.AUTH0_DOMAIN;
  process.env.AUTH0_ISSUER_BASE_URL = d.startsWith("https://") ? d : `https://${d}`;
}

import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

const baseUrl = process.env.AUTH0_BASE_URL || process.env.APP_BASE_URL || "http://localhost:3000";
const domain = process.env.AUTH0_ISSUER_BASE_URL || process.env.AUTH0_DOMAIN;
const issuerBaseUrl = domain
  ? domain.startsWith("https://")
    ? domain
    : `https://${domain}`
  : "";

const nextConfig: NextConfig = {
  env: {
    // AUTH0_BASE_URL: statik localhost değeri, build'e bake edilir.
    // AUTH0_ISSUER_BASE_URL buraya EKLENMEZ — Docker build sırasında
    // AUTH0_DOMAIN boş olduğundan "" bake edilir ve runtime'ı ezer.
    // AUTH0_ISSUER_BASE_URL .env dosyasından runtime'da okunur.
    AUTH0_BASE_URL: baseUrl,
  },
  webpack: (config, { isServer }) => {
    config.module ??= {};
    config.module.rules ??= [];
    config.module.rules.push({
      test: /\.wasm$/,
      loader: "base64-loader",
      type: "javascript/auto",
    });
    config.module.noParse = /\.wasm$/;

    config.resolve ??= {};
    config.resolve.fallback ??= {};
    if (!isServer) {
      config.resolve.fallback.fs = false;
    }
    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
