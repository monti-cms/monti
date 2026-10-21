import type { NoticeKey } from "../../core/store/errors.js";
import { ServiceError } from "../types.js";
/** A request the import refuses, with the text a person reads (a key of the core notice dictionary). */
export declare const importNotice: (key: NoticeKey, vars?: Record<string, string>) => ServiceError;
