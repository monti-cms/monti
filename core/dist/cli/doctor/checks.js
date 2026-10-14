import { AUTH_CHECKS } from "./auth-checks.js";
import { CONFIG_CHECKS } from "./config-checks.js";
import { DATABASE_CHECKS } from "./database-checks.js";
import { NEXT_CHECKS } from "./next-checks.js";
import { SCHEMA_CHECKS } from "./schema-checks.js";
import { SECRETS_CHECKS } from "./secrets-checks.js";
/** The order the groups are printed in. */
export const GROUP_ORDER = ["config", "schema", "database", "secrets", "auth", "next"];
/** The checks of core itself, in the order they run. Each group lives in its own file; a check says which group it belongs to. */
export const CORE_CHECKS = [
    ...CONFIG_CHECKS,
    ...SCHEMA_CHECKS,
    ...DATABASE_CHECKS,
    ...SECRETS_CHECKS,
    ...AUTH_CHECKS,
    ...NEXT_CHECKS,
];
