import type { Cms } from "@monti-cms/core/server";
import { describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { AdminPage } from "../page";
import type { AdminServer } from "../server";

const page = vi.hoisted(() => (name: string) => ({ default: (props: Record<string, unknown>) => ({ name, props }) }));
vi.mock("../../screens/settings/page", () => page("settings"));
vi.mock("../../screens/tools/page", () => page("tools"));
vi.mock("../../screens/trash/page", () => page("trash"));
vi.mock("../../screens/media/page", () => page("media"));
vi.mock("../../screens/page", () => page("dashboard"));
vi.mock("../../screens/login/page", () => page("login"));
vi.mock("../../screens/templates/edit-page", () => page("template"));
vi.mock("../../screens/entries/new/page", () => page("new"));
vi.mock("../../screens/entries/[id]/edit/page", () => page("edit"));

const cms = { site: testSite } as unknown as Cms;
const server: AdminServer = {
	redirect: () => {
		throw new Error("redirect");
	},
	notFound: () => {
		throw new Error("not-found");
	},
};
const open = async (...path: string[]) => {
	const element = (await AdminPage({
		cms,
		server,
		params: Promise.resolve({ path }),
		searchParams: Promise.resolve({}),
	})) as unknown as {
		type: (props: Record<string, unknown>) => { name: string; props: Record<string, unknown> };
		props: Record<string, unknown>;
	};
	return element.type(element.props);
};

describe("admin addresses", () => {
	it("gives trash and media their own address", async () => {
		expect((await open("trash")).name).toBe("trash");
		expect((await open("media")).name).toBe("media");
	});

	it("has no top-level address for what is a tab of the tools page now", async () => {
		for (const path of ["templates", "data", "events", "api-keys"])
			await expect(open(path)).rejects.toThrow("not-found");
	});

	it("opens a schema tab under settings, and nothing else there", async () => {
		expect((await open("settings", "locales")).props).toMatchObject({ tab: "locales" });
		expect((await open("settings")).props).toMatchObject({ tab: undefined });
	});

	it("opens a tab of the tools page by its path, and the bare tools address with none", async () => {
		for (const path of ["templates", "ai"]) {
			const result = await open("tools", path);
			expect(result.name).toBe("tools");
			expect(result.props).toMatchObject({ path });
		}
		expect((await open("tools")).props).toMatchObject({ path: undefined });
	});

	it("opens a template on a page of its own: a new one, or one by its id", async () => {
		expect((await open("templates", "new")).name).toBe("template");
		expect((await open("templates", "new")).props).toMatchObject({ id: undefined });
		expect((await open("templates", "t1", "edit")).props).toMatchObject({ id: "t1" });
		await expect(open("templates", "t1")).rejects.toThrow("not-found");
	});

	it("is a 404 for deeper tools paths", async () => {
		await expect(open("tools", "ai", "x")).rejects.toThrow("not-found");
	});
});
