import type { Db } from "@sipilian/db";

/**
 * Ambient request context passed to every handler.
 */
export interface RequestContext {
  readonly userId: string;
  readonly db: Db;
  readonly now: Date;
}
