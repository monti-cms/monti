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
 * `trash` 리소스: `trashed_at`이 있는 글·폴더·미디어. 폴더는 그 안의 항목을 같은 `trashed_at`으로 데려가고, 그 항목들은
 * 폴더와 함께 보이고 되살아나고 지워진다.
 */
export const trash = {
	move: defineWrite({ input: idInput, run: moveItem }),
	list: defineRead({ input: z.object({}), run: listAll }),
	get: defineRead({ input: idInput, run: getItem }),
	restore: defineWrite({ input: idInput, run: restoreItem }),
	delete: defineWrite({ input: deleteInput, run: deleteItems }),
};
