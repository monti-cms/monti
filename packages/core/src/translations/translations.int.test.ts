import { describe, it } from "vitest";

describe("a new translation", () => {
	it.todo(
		"04-1 translations.create makes an entry of the language in the source's group, every block copied as pending with its source block id and hash",
	);
	it.todo("04-1 a block with no text to translate (code) starts as followSource");
	it.todo("04-1 the new translation starts from the source's address, and its per-language fields are empty");
	it.todo(
		"04-1 translations.create refuses a language the site does not have, the source language, and one the group has",
	);
	it.todo("04-1 translations.create from a translation is refused: a translation is made from the source");
	it.todo("04-1 translations.setBlocks keeps a pending block in the source's words, or removes it");
	it.todo("04-1 typing into a pending block and saving makes it translated");
	it.todo("04-1 a body.edit on a translated block marks it translated against the source block as it is now");
	it.todo(
		"04-1 'only in this language' makes a followSource block translated, and the site then shows the translation's own block",
	);
});

describe("pending blocks", () => {
	it.todo("04-3 a translation with pending blocks cannot be published; its to-do list names each pending block");
	it.todo("04-3 once every pending block is decided, the translation publishes under its language");
	it.todo("04-3 the site never draws a pending block, even in a preview");
});

describe("when the source changes", () => {
	it.todo("04-2 saving the source without publishing it marks nothing in its translations");
	it.todo(
		"04-2 publishing the source again marks exactly the blocks that changed, the ones removed and the ones added",
	);
	it.todo("04-2 translations.compare gives each changed block the source before and after");
	it.todo("04-2 confirming a changed block clears its mark and keeps its text");
	it.todo("04-2 a body.edit re-translation of a changed block clears its mark");
	it.todo("04-2 a removed mark is confirmed (the block stays, unpaired) or the block is removed");
	it.todo("04-2 an added source block goes in as a pending block, kept in the source's words, or left out for good");
	it.todo("04-2 translations.confirmAll clears changed and removed marks, and leaves added blocks to be decided");
	it.todo("04-2 publishing the source back to what the translation saw clears the marks again");
	it.todo("04-2 a published translation stays published while its source changes");
});

describe("translation status", () => {
	it.todo(
		"04-4 translations.status gives each group's languages with their state, their source changes and their pending blocks",
	);
	it.todo(
		"04-4 the list's translation filters and facets (missing, source changed, up to date) count the same groups translations.status reports",
	);
	it.todo("T52 the list row of a group is its source-language entry, whichever was made first");
	it.todo("T52 the list has a language column only when the site has more than one language");
});

describe("field values in a translation", () => {
	it.todo("04-5 a 'same' field reads the source's value, and a translation cannot save its own");
	it.todo("04-5 a 'fromSource' field reads the translation's value, or the source's while it is empty");
	it.todo("04-5 the site reads a published translation's fields by the same rules");
	it.todo("04-5 the publish to-do list of a translation checks a required 'same' field on the source");
});

describe("creating entries", () => {
	it.todo("T26 entries.create takes only the site's source language, by default the source language");
	it.todo("T26 entries.duplicate copies only a source-language entry");
});

describe("the site's languages", () => {
	it.todo("04-6 the schema's languages are checked: a known source, codes once each, at least one");
	it.todo(
		"04-6 locales.plan lists the languages added and removed and a source change, with the translations each touches",
	);
	it.todo("04-6 adding a language changes no entry");
	it.todo("04-6 removing a language with translations deletes them after the review's 'delete and apply'");
	it.todo("04-6 a new source language with an entry in a group makes that entry the source and pairs the blocks again");
	it.todo(
		"04-6 a new source language without an entry in a group gets a draft of pending blocks copied from the old source",
	);
	it.todo("04-6 after a source change every published entry is still published as it was");
	it.todo(
		"04-6 locales.apply is a structure change: it writes the file and a change file, and the live site has no way to run it",
	);
});
