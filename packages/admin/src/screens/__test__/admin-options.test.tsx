import type { Cms } from "@monti-cms/core/server";
import { type CmsConfig, createSite } from "@monti-cms/core/site";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testConfig, testSite } from "../../../../core/test/site";
import type { AdminServer } from "../../host/server";
import SettingsPage from "../settings/page";
import { SCHEMA_TABS, settingsTabs } from "../settings/tabs";
import TemplatesPage from "../templates/page";

vi.mock("../require-admin", () => ({ requireAdminPage: async () => undefined }));
vi.mock("../settings/settings-screen", () => ({ SettingsScreen: () => <p>settings screen</p> }));

afterEach(cleanup);

const withAdmin = (admin: Record<string, unknown>) =>
	createSite({ ...testConfig, admin: { ...testConfig.admin, ...admin } } as CmsConfig);
const cms = (site: typeof testSite) => ({ site }) as unknown as Cms;
const server = (): AdminServer => ({
	redirect: vi.fn((href: string) => {
		throw new Error(`redirect:${href}`);
	}),
	notFound: vi.fn(() => {
		throw new Error("not-found");
	}),
});

describe("settings tabs", () => {
	it("are the schema file's tabs, Site first; templates, the event log and plugin pages are not among them", () => {
		const ids: string[] = settingsTabs(testSite).map((tab) => tab.id);
		expect(ids.filter((id) => id !== "api-keys")).toEqual([...SCHEMA_TABS]);
		expect(ids[0]).toBe("site");
	});
});

describe("settings page", () => {
	it("sends the bare settings address to the first tab", async () => {
		await expect(SettingsPage({ cms: cms(testSite), server: server(), tab: undefined })).rejects.toThrow(
			`redirect:${testSite.adminHref(`/settings/${SCHEMA_TABS[0]}`)}`,
		);
	});

	it("opens a schema tab", async () => {
		const stop = server();
		await expect(SettingsPage({ cms: cms(testSite), server: stop, tab: "locales" })).resolves.toBeTruthy();
		expect(stop.notFound).not.toHaveBeenCalled();
	});

	it("is a 404 for a tab nobody owns, including the screens that used to be tabs (the API keys moved to their own page)", async () => {
		for (const tab of ["nope", "schema", "templates", "events", "ai", "api-keys"]) {
			await expect(SettingsPage({ cms: cms(testSite), server: server(), tab })).rejects.toThrow("not-found");
		}
	});
});

describe("templates page", () => {
	it("opens by default", async () => {
		const stop = server();
		await expect(TemplatesPage({ cms: cms(testSite), server: stop })).resolves.toBeTruthy();
		expect(stop.notFound).not.toHaveBeenCalled();
	});

	it("is a 404 when the site turns templates off", async () => {
		const stop = server();
		await expect(TemplatesPage({ cms: cms(withAdmin({ templates: false })), server: stop })).rejects.toThrow(
			"not-found",
		);
		expect(stop.notFound).toHaveBeenCalled();
	});
});
