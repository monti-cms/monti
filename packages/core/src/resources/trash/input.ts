import { z } from "zod";
import { timestampInput, uuidInput } from "../_shared/input";

export const idInput = z.object({ id: uuidInput });

/** Exactly one of: one id, several ids, the items trashed before a time, or all of them. */
export const deleteInput = z.union([
	z.strictObject({ id: uuidInput }),
	z.strictObject({ ids: z.array(uuidInput) }),
	z.strictObject({ before: timestampInput }),
	z.strictObject({ all: z.literal(true) }),
]);
