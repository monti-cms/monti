import type { Reference } from "../types.js";
/** Whether two reference lists are the same, occurrences included (a body occurrence's `blockId` is part of it). */
export declare function isReferencesEqual(a: readonly Reference[], b: readonly Reference[]): boolean;
