import { z } from "zod";
import { defineRead, defineWrite } from "../../engine/operation";
import type { ReadContext } from "../../engine/types";
import { deleteItems } from "./delete";
import { deleteInput, idInput } from "./input";
import { findItem, listItems, type TrashItem } from "./items";
import { moveItem } from "./move";
import { restoreItem } from "./restore";

async function getItem(input: z.infer<typeof idInput>, ctx: ReadContext): Promise<TrashItem> {
	return findItem(ctx, input.id);
}

async function listAll(_: unknown, ctx: ReadContext): Promise<TrashItem[]> {
	return listItems(ctx);
}

/**
 * The `trash` resource: entries, folders and media with a `trashed_at`. A folder takes what is in it along with the
 * same `trashed_at`, and those items are shown, restored and deleted with it.
 */
export const trash = {
	move: defineWrite({ input: idInput, run: moveItem }),
	list: defineRead({ input: z.object({}), run: listAll }),
	get: defineRead({ input: idInput, run: getItem }),
	restore: defineWrite({ input: idInput, run: restoreItem }),
	delete: defineWrite({ input: deleteInput, run: deleteItems }),
};
