import { ServiceError } from "../types.js";
/** A request the import refuses, with the text a person reads (a key of the core notice dictionary). */
export const importNotice = (key, vars) => new ServiceError("invalid_input", undefined, undefined, { notice: { key, ...(vars ? { vars } : {}) } });
