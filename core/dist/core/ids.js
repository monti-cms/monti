import { UUID_PATTERN } from "../config/rules.js";
/** Is this the fixed ID (UUID) format for content, folders and media? */
export const isUuid = (value) => typeof value === "string" && UUID_PATTERN.test(value);
