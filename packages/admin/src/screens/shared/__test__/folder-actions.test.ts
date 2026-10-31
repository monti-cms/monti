import type { Folder } from "@monti-cms/core/site";
import { describe, expect, it } from "vitest";
import { isInsideFolder } from "../use-folder-actions";

const folder = (id: string, parentId: string | null): Folder => ({
	id,
	collection: "post",
	parentId,
	name: id,
	position: 0,
	version: 1,
});
// a > b > c, and d beside a
const folders = [folder("a", null), folder("b", "a"), folder("c", "b"), folder("d", null)];

describe("a screen that shows a folder which goes to the trash", () => {
	it("LIST-F6 leaves the folder itself and every folder inside it, and stays in the others", () => {
		expect(isInsideFolder(folders, "a", "a")).toBe(true);
		expect(isInsideFolder(folders, "c", "a")).toBe(true);
		expect(isInsideFolder(folders, "b", "c")).toBe(false);
		expect(isInsideFolder(folders, "d", "a")).toBe(false);
	});

	it("ends on a folder that is not known or on a loop in the data", () => {
		expect(isInsideFolder(folders, "gone", "a")).toBe(false);
		expect(isInsideFolder([folder("x", "y"), folder("y", "x")], "x", "a")).toBe(false);
	});
});
