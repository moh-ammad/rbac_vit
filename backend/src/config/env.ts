import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing in backend/.env`);
  return value;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  port: Number(process.env.PORT) || 3000,
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3001",
  isProduction: process.env.NODE_ENV === "production",
  // Set COOKIE_SECURE=true when serving over HTTPS.
  cookieSecure: process.env.COOKIE_SECURE === "true",
};
