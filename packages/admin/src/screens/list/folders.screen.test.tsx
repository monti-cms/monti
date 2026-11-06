import { describe, it } from "vitest";

// Doc 07 in the list and the sidebar (flow 5, 01–08), written before the code: each todo becomes a test that fails first, then passes.
describe("folders in the list", () => {
	it.todo(
		"07-2 [flow 5·01] '새 폴더' in the pill's menu puts a new folder row on top, its name picked; typing replaces it, Enter keeps it",
	);
	it.todo("[flow 5·01] Esc in the new folder's name drops the folder");
	it.todo("07-2 [flow 5·02] a folder opens to its own rows under its path and '상위 폴더로'; both go back up");
	it.todo("07-2 [flow 5·03] a search in a folder looks in it first; '모든 폴더' widens it to the collection");
	it.todo("07-2 [flow 5·04] a folder row's right-click menu renames it in place and moves it into another folder");
	it.todo("07-2 [flow 5·05] removing a folder with a published post asks first and says how many go off the site");
	it.todo("07-2 [flow 5·06] a folder of drafts goes to the trash without asking; the toast's undo brings it back");
	it.todo("07-2 [flow 5·07] a row's '폴더로 ▸' moves its post into a folder");
	it.todo("07-2 [flow 5·08] picked rows move together from the bulk bar's '폴더로'");
	it.todo(
		"[overflow-after-add] ten folders with long names: the list and the sidebar still fit, nothing scrolls sideways",
	);
});

describe("folders in the sidebar", () => {
	it.todo("07-2 the open collection shows its folder tree; a row opens that folder and stays picked while it is open");
	it.todo("'폴더 사용' off: no tree and no '새 폴더'; on again, the folders are back");
	it.todo("[dragging] a folder dragged in the tree stays under the pointer, and the others make room (T43)");
	it.todo("[dropped] a folder dropped on another goes inside it; the tree and the counts follow (T43)");
	it.todo("[keys-move] a folder moves with the keyboard to the same place a drag would put it (T43)");
});
