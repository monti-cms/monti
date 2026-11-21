import { z } from "zod";
import { timestampInput, uuidInput } from "../_shared/input";

export const idInput = z.object({ id: uuidInput });

/** 다음 가운데 정확히 하나: `id` 하나, 여러 `ids`, 어떤 시각보다 먼저 버린 항목, 또는 전부. */
export const deleteInput = z.union([
	z.strictObject({ id: uuidInput }),
	z.strictObject({ ids: z.array(uuidInput) }),
	z.strictObject({ before: timestampInput }),
	z.strictObject({ all: z.literal(true) }),
]);
