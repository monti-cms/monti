import type { Folder } from "@monti-cms/core/site";
import { describe, expect, it } from "vitest";
import { folderPath, railFolders } from "../rail-folders";

const folder = (id: string, name: string, parentId: string | null = null): Folder => ({
	id,
	collection: "post",
	parentId,
	name,
	position: 0,
	version: 1,
});

const dev = folder("dev", "Dev");
const next = folder("next", "Next.js", "dev");
const app = folder("app", "App router", "next");
const essays = folder("essays", "Essays");
const folders = [dev, next, app, essays];
const names = (rows: ReturnType<typeof railFolders>) => rows.map((row) => `${row.depth}:${row.folder.name}`);

describe("the folders the rail shows", () => {
	it("LIST-F6 shows only the top level while no folder is open", () => {
		expect(names(railFolders(folders, "all"))).toEqual(["0:Dev", "0:Essays"]);
	});

	it("LIST-F6 shows the folders inside the open folder, right under it", () => {
		expect(names(railFolders(folders, "dev"))).toEqual(["0:Dev", "1:Next.js", "0:Essays"]);
	});

	it("LIST-F6 keeps every folder on the way to a deep open folder, and the folders inside it", () => {
		expect(names(railFolders(folders, "next"))).toEqual(["0:Dev", "1:Next.js", "2:App router", "0:Essays"]);
		expect(names(railFolders(folders, "app"))).toEqual(["0:Dev", "1:Next.js", "2:App router", "0:Essays"]);
	});

	it("LIST-F6 does not open the folders of a folder beside the open one", () => {
		const other = folder("other", "Other", "essays");
		expect(names(railFolders([...folders, other], "dev"))).toEqual(["0:Dev", "1:Next.js", "0:Essays"]);
	});
});

describe("the path to a folder", () => {
	it("LIST-F6 runs from the top-level folder to the folder itself", () => {
		expect(folderPath(folders, "app").map((entry) => entry.name)).toEqual(["Dev", "Next.js", "App router"]);
		expect(folderPath(folders, "essays").map((entry) => entry.name)).toEqual(["Essays"]);
	});
});
