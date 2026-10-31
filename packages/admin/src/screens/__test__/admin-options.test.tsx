import type { CmsConfig } from "@monti-cms/core";
import type { Cms } from "@monti-cms/core/server";
import { createSite } from "@monti-cms/core/site";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testConfig, testSite } from "../../../../core/test/site";
import type { AdminServer } from "../../host/server";
import SettingsPage from "../settings/page";
import { SettingsScreen } from "../settings/settings-screen";
import { SCHEMA_TABS, settingsTabs } from "../settings/tabs";

afterEach(cleanup);

const _withAdmin = (admin: Record<string, unknown>) =>
	createSite({ ...testConfig, admin: { ...testConfig.admin, ...admin } } as CmsConfig);
// The auth gateway is the edge: it lets the admin in.
const cms = (site: typeof testSite) => ({ site, authGateway: { verifyAdmin: async () => ({}) } }) as unknown as Cms;
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
	it("ADMIN-U1 sends the bare settings address to the first tab", async () => {
		await expect(SettingsPage({ cms: cms(testSite), server: server(), tab: undefined })).rejects.toThrow(
			`redirect:${testSite.adminHref(`/settings/${SCHEMA_TABS[0]}`)}`,
		);
	});

	it("ADMIN-U1 opens a schema tab", async () => {
		const stop = server();
		await expect(SettingsPage({ cms: cms(testSite), server: stop, tab: "locales" })).resolves.toMatchObject({
			type: SettingsScreen,
			props: { tab: "locales" },
		});
		expect(stop.notFound).not.toHaveBeenCalled();
	});

	it("ADMIN-U1 is a 404 for a tab nobody owns, including the screens that used to be tabs (the API keys moved to their own page)", async () => {
		for (const tab of ["nope", "schema", "templates", "events", "ai", "api-keys"]) {
			await expect(SettingsPage({ cms: cms(testSite), server: server(), tab })).rejects.toThrow("not-found");
		}
	});
});
