export function publicUrl(request?: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (request) return new URL(request.url).origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

export function serviceStatus() {
  return {
    steam: Boolean(process.env.STEAM_API_KEY),
    database: process.env.DATABASE_URL ? "Postgres" : "Local database on this machine",
    storage: r2Configured() ? "Cloudflare R2" : "Local disk",
    r2: r2Configured(),
    vercel: Boolean(process.env.VERCEL),
    appUrl: publicUrl(),
  };
}
