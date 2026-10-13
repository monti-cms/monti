import { UUID_PATTERN } from "../config/rules";

/** Is this the fixed ID (UUID) format for content, folders and media? */
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_PATTERN.test(value);
