import type { CoreCheck } from "./types.js";
/** The order the groups are printed in. */
export declare const GROUP_ORDER: readonly ["config", "schema", "database", "secrets", "auth", "next"];
/** The checks of core itself, in the order they run. Each group lives in its own file; a check says which group it belongs to. */
export declare const CORE_CHECKS: readonly CoreCheck[];
