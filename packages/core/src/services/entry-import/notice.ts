import type { NoticeKey } from "../../core/store/errors";
import { ServiceError } from "../types";

/** A request the import refuses, with the text a person reads (a key of the core notice dictionary). */
export const importNotice = (key: NoticeKey, vars?: Record<string, string>) =>
	new ServiceError("invalid_input", undefined, undefined, { notice: { key, ...(vars ? { vars } : {}) } });
