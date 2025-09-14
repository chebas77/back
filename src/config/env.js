import 'dotenv/config';

export const config = {
  port: process.env.PORT || 4000,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  // ⚠️ en dev puedes poner un fallback, en prod NO
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  port: process.env.PORT || 4000,
  env: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL,
 db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME, // "alignment manager"
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES || '7d',
  },

  cookie: {
    name: process.env.COOKIE_NAME || 'token',
    domain: process.env.COOKIE_DOMAIN || 'localhost',
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAMESITE || 'Lax',
  },

  google: {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
  },
};
