import { auth } from "./server";

export { authEnv } from "./env";
export { isAdmin, requireAdmin, ROLES } from "./roles";
export type { AuthError, AuthErrorCode, Role, RoleBearer } from "./roles";
export { auth };

export type Session = typeof auth.$Infer.Session;

export type AuthUser = Session["user"];
