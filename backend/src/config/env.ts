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
  trustProxy: process.env.TRUST_PROXY === "false" ? false : process.env.NODE_ENV === "production" ? 1 : false,
  cookieSecure: process.env.COOKIE_SECURE === "false" ? false : process.env.NODE_ENV === "production",
};
