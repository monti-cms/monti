import { z } from "zod";
import { defineOperation } from "../define";

export const listFolders = defineOperation({
	name: "folders.list",
	kind: "read",
	describe:
		'The folder tree of one collection (or of the media library, with collection "media"): every folder with its parent, name and position. Fails for a collection that does not use folders.',
	input: (site) => z.object({ collection: site.api.folderCollectionSchema }),
	run: ({ collection }, { cms }) => cms.store().listFolders({ collection }),
});

export const getFolder = defineOperation({
	name: "folders.get",
	kind: "read",
	describe:
		"What a folder holds, its subfolders included: the entries (once per translation group, with how many are published), the folders below it, and the media files (with how many are in use). Use it before discarding a folder.",
	input: () => z.object({ id: z.uuid().describe("The id of the folder") }),
	run: ({ id }, { cms }) => cms.store().getFolderContents({ id }),
});
