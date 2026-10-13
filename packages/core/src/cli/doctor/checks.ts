import { AUTH_CHECKS } from "./auth-checks";
import { CONFIG_CHECKS } from "./config-checks";
import { DATABASE_CHECKS } from "./database-checks";
import { NEXT_CHECKS } from "./next-checks";
import { SCHEMA_CHECKS } from "./schema-checks";
import { SECRETS_CHECKS } from "./secrets-checks";
import type { CoreCheck } from "./types";

/** The order the groups are printed in. */
export const GROUP_ORDER = ["config", "schema", "database", "secrets", "auth", "next"] as const;

/** The checks of core itself, in the order they run. Each group lives in its own file; a check says which group it belongs to. */
export const CORE_CHECKS: readonly CoreCheck[] = [
	...CONFIG_CHECKS,
	...SCHEMA_CHECKS,
	...DATABASE_CHECKS,
	...SECRETS_CHECKS,
	...AUTH_CHECKS,
	...NEXT_CHECKS,
];
