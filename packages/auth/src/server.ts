import { expo } from "@better-auth/expo";
import { db } from "@sipilian/db";
import { accounts, sessions, users, verifications } from "@sipilian/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { authEnv } from "./env";

const sevenDaysInSeconds = 60 * 60 * 24 * 7;

/**
 * Configured Better Auth server instance shared by web and mobile clients.
 */
export const auth = betterAuth({
  secret: authEnv.secret,
  baseURL: authEnv.baseUrl,
  trustedOrigins: [...authEnv.trustedOrigins],
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema: { user: users, session: sessions, account: accounts, verification: verifications },
  }),
  emailAndPassword: { enabled: true, requireEmailVerification: false },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "user", input: false },
    },
  },
  session: { expiresIn: sevenDaysInSeconds },
  plugins: [expo()],
});
