import { z } from "zod";

/** A UUID in any case, stored lowercased so equality and jsonb matches do not depend on the input's case. */
export const uuidInput = z.uuid().overwrite((id) => id.toLowerCase());

/** An ISO 8601 date-time with a time zone offset. */
export const timestampInput = z.iso.datetime({ offset: true });
