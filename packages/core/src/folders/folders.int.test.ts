import { describe, it } from "vitest";

// Doc 07 (folders), written before the code: each todo becomes a test that fails first, then passes.
describe("folders", () => {
	it.todo("07-1 the same operations make, rename, move and remove folders of posts and of media");
	it.todo(
		"folders.tree gives a scope's folders as a tree, each counting its own entries and its subfolders', trash left out",
	);
	it.todo("folders.create names a folder that is taken among its siblings with ' 2'");
	it.todo("folders.rename refuses a name a sibling has");
	it.todo("folders.move refuses to put a folder inside itself or one of its own subfolders");
	it.todo("entries.moveToFolder moves the whole translation group, and to the top level with null");
	it.todo("07-3 moving entries or a folder leaves the entries' addresses and publish state as they were");
	it.todo("folders.remove previews how many entries, subfolders and published entries go with the folder");
	it.todo(
		"07-3 removing a folder puts it, its subfolders and their entries in the trash; only the published ones go off the site",
	);
	it.todo("undoing a folder's removal brings the folder, its subfolders and their entries back as they were");
	it.todo(
		"07-4 'make a folder and move these there' is one proposal; leaving out the first item leaves out the second",
	);
});
