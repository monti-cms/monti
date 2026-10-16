import type { Cms } from "@monti-cms/core/server";
import { describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { AdminPage } from "../page";
import type { AdminServer } from "../server";

const page = vi.hoisted(() => (name: string) => ({ default: (props: Record<string, unknown>) => ({ name, props }) }));
vi.mock("../../screens/settings/page", () => page("settings"));
vi.mock("../../screens/templates/page", () => page("templates"));
vi.mock("../../screens/events/page", () => page("events"));
vi.mock("../../screens/api-keys/page", () => page("api-keys"));
vi.mock("../../screens/tools/page", () => page("tools"));
vi.mock("../../screens/trash/page", () => page("trash"));
vi.mock("../../screens/media/page", () => page("media"));
vi.mock("../../screens/page", () => page("dashboard"));
vi.mock("../../screens/login/page", () => page("login"));
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
	it("gives templates, the API keys, the event log and trash their own address", async () => {
		expect((await open("templates")).name).toBe("templates");
		expect((await open("api-keys")).name).toBe("api-keys");
		expect((await open("events")).name).toBe("events");
		expect((await open("trash")).name).toBe("trash");
	});

	it("opens a schema tab under settings, and nothing else there", async () => {
		expect((await open("settings", "locales")).props).toMatchObject({ tab: "locales" });
		expect((await open("settings")).props).toMatchObject({ tab: undefined });
	});

	it("opens a plugin page under tools with its path", async () => {
		const result = await open("tools", "ai");
		expect(result.name).toBe("tools");
		expect(result.props).toMatchObject({ path: "ai" });
	});

	it("is a 404 for a bare tools address and for deeper paths", async () => {
		await expect(open("tools")).rejects.toThrow("not-found");
		await expect(open("tools", "ai", "x")).rejects.toThrow("not-found");
	});
});
