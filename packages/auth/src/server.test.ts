import { randomUUID } from "node:crypto";

import { db } from "@sipilian/db";
import { users } from "@sipilian/db/schema";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { auth } from "./server";

const createdEmails: string[] = [];

// eslint-disable-next-line sonarjs/no-hardcoded-passwords
const SIGNUP_PASSWORD = "Passw0rd!test";

const hasRealDb = !process.env.DATABASE_URL?.includes("localhost:5432/db");

/**
 * Generates a unique test email so repeated runs never collide.
 * @returns A unique example.com email address.
 */
function uniqueEmail(): string {
  return `test-${Date.now().toString()}-${randomUUID().slice(0, 8)}@example.com`;
}

afterEach(async () => {
  for (const email of createdEmails.splice(0)) {
    await db.delete(users).where(eq(users.email, email));
  }
});

describe("auth server instance", () => {
  it("exposes the Better Auth handler and api", () => {
    expect(typeof auth.handler).toBe("function");
    expect(auth.api).toBeDefined();
  });
});

describe("email auth integration (Neon dev)", () => {
  it.skipIf(!hasRealDb)(
    "signs up then signs in a new user defaulting to the user role",
    async () => {
      const email = uniqueEmail();
      const password = SIGNUP_PASSWORD;

      createdEmails.push(email);

      const signUp = await auth.api.signUpEmail({
        body: { email, password, name: "Integration Test User" },
      });

      expect(signUp.user.email).toBe(email);

      const signIn = await auth.api.signInEmail({ body: { email, password } });

      expect(signIn.token).toBeTruthy();

      const [row] = await db.select().from(users).where(eq(users.email, email));

      expect(row?.role).toBe("user");
    },
  );
});
