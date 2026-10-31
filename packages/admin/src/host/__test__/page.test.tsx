import type { Cms } from "@monti-cms/core/server";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import MediaPage from "../../screens/media/page";
import SettingsPage from "../../screens/settings/page";
import TemplateEditPage from "../../screens/templates/edit-page";
import ToolsPage from "../../screens/tools/page";
import TrashPage from "../../screens/trash/page";
import { AdminPage } from "../page";
import type { AdminServer } from "../server";

const cms = { site: testSite } as unknown as Cms;
const server: AdminServer = {
	redirect: () => {
		throw new Error("redirect");
	},
	notFound: () => {
		throw new Error("not-found");
	},
};
/** The screen an admin address picks: the page component `AdminPage` returns, and the props it hands it (the screen is not rendered). */
const open = async (...path: string[]) =>
	(await AdminPage({
		cms,
		server,
		params: Promise.resolve({ path }),
		searchParams: Promise.resolve({}),
	})) as ReactElement<Record<string, unknown>>;

describe("admin addresses", () => {
	it("ADMIN-U1 gives trash and media their own address", async () => {
		expect((await open("trash")).type).toBe(TrashPage);
		expect((await open("media")).type).toBe(MediaPage);
	});

	it("ADMIN-U1 has no top-level address for what is a tab of the tools page now", async () => {
		for (const path of ["templates", "data", "events", "api-keys"])
			await expect(open(path)).rejects.toThrow("not-found");
	});

	it("ADMIN-U1 opens a schema tab under settings, and nothing else there", async () => {
		const tab = await open("settings", "locales");
		expect(tab.type).toBe(SettingsPage);
		expect(tab.props).toMatchObject({ tab: "locales" });
		expect((await open("settings")).props).toMatchObject({ tab: undefined });
	});

	it("ADMIN-U1 opens a tab of the tools page by its path, and the bare tools address with none", async () => {
		for (const path of ["templates", "ai"]) {
			const result = await open("tools", path);
			expect(result.type).toBe(ToolsPage);
			expect(result.props).toMatchObject({ path });
		}
		expect((await open("tools")).props).toMatchObject({ path: undefined });
	});

	it("ADMIN-U1 opens a template on a page of its own: a new one, or one by its id", async () => {
		expect((await open("templates", "new")).type).toBe(TemplateEditPage);
		expect((await open("templates", "new")).props).toMatchObject({ id: undefined });
		expect((await open("templates", "t1", "edit")).props).toMatchObject({ id: "t1" });
		await expect(open("templates", "t1")).rejects.toThrow("not-found");
	});

	it("ADMIN-U1 is a 404 for deeper tools paths", async () => {
		await expect(open("tools", "ai", "x")).rejects.toThrow("not-found");
	});
});
