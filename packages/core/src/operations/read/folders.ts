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
		"One folder with the number of entries directly in it and of its child folders. Use it to see what a folder holds.",
	input: () => z.object({ id: z.uuid().describe("The id of the folder") }),
	run: ({ id }, { cms }) => cms.store().getFolderContents({ id }),
});
