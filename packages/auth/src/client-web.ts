import { createAuthClient } from "better-auth/client";

import { authEnv } from "./env";

/**
 * Auth client for the admin web app; browser cookie session is the default.
 */
export const authClient = createAuthClient({ baseURL: authEnv.baseUrl });
