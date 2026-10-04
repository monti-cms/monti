const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 콘텐츠·폴더·미디어의 고정 ID(UUID) 형식인가. */
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_PATTERN.test(value);
