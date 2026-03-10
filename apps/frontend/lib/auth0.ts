import { initAuth0 } from "@auth0/nextjs-auth0";

const baseUrl =
  process.env.AUTH0_BASE_URL ?? process.env.APP_BASE_URL ?? "http://localhost:3000";
const domain =
  process.env.AUTH0_ISSUER_BASE_URL ?? process.env.AUTH0_DOMAIN ?? "";

export default initAuth0({
  secret: process.env.AUTH0_SECRET!,
  issuerBaseURL: domain.startsWith("https://") ? domain : `https://${domain}`,
  baseURL: baseUrl,
  clientID: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  authorizationParams: {
    audience: process.env.AUTH0_AUDIENCE ?? "http://localhost:3001",
  },
});
