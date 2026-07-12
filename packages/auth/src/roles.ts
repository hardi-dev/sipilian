import { err, ok,type Result } from "@sipilian/core";

/**
 * Canonical role identifiers stored on the user row.
 */
export const ROLES = { admin: "admin", user: "user" } as const;

export type Role = "admin" | "user";

/**
 * Minimal shape needed to evaluate a user's role.
 */
export interface RoleBearer {
  readonly role: string;
}

export type AuthErrorCode = "not_admin";

/**
 * Expected, non-throwing error returned by role guards.
 */
export interface AuthError {
  readonly code: AuthErrorCode;
  readonly message: string;
}

/**
 * Reports whether the given user holds the admin role.
 * @param user - The role-bearing user to check.
 * @returns True when the user's role equals the admin role.
 */
export function isAdmin(user: RoleBearer): boolean {
  return user.role === ROLES.admin;
}

/**
 * Requires the user to be an admin, returning a Result instead of throwing.
 * @param user - The role-bearing user to guard.
 * @returns Ok with the user when admin, otherwise Err with an AuthError.
 */
export function requireAdmin(user: RoleBearer): Result<RoleBearer, AuthError> {
  if (!isAdmin(user)) {
    return err({ code: "not_admin", message: "User must have the admin role." });
  }

  return ok(user);
}
