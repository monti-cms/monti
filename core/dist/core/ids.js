const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Is this the fixed ID (UUID) format for content, folders and media? */
export const isUuid = (value) => typeof value === "string" && UUID_PATTERN.test(value);
