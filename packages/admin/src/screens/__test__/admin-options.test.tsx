import { type AnyCmsConfig, createSite } from "@monti-cms/core/client";
import type { Cms } from "@monti-cms/core/runtime";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testConfig, testSite } from "../../../../core/test/site";
import type { AdminServer } from "../../host/server";
import SettingsPage from "../settings/page";
import { settingsTabs } from "../settings/tabs";

vi.mock("../require-admin", () => ({ requireAdminPage: async () => undefined }));
vi.mock("../settings/settings-screen", () => ({ SettingsScreen: () => <p>settings screen</p> }));

afterEach(cleanup);

const withAdmin = (admin: Record<string, unknown>) =>
	createSite({ ...testConfig, admin: { ...testConfig.admin, ...admin } } as AnyCmsConfig);

describe("templates tab", () => {
	it("is a settings tab by default", () => {
		expect(settingsTabs(testSite).map((tab) => tab.id)).toContain("templates");
	});

	it("is gone when the site turns templates off, and the other tabs stay", () => {
		const ids = settingsTabs(withAdmin({ templates: false })).map((tab) => tab.id);
		expect(ids).not.toContain("templates");
		expect(ids).toContain("collections");
		expect(ids).toContain("events");
	});
});

describe("settings page", () => {
	const cms = (site: typeof testSite) => ({ site }) as unknown as Cms;
	const server = (): AdminServer => ({
		redirect: vi.fn((href: string) => {
			throw new Error(`redirect:${href}`);
		}),
		notFound: vi.fn(() => {
			throw new Error("not-found");
		}),
	});

	it("is a 404 for the templates tab when the site turns templates off", async () => {
		const stop = server();
		await expect(
			SettingsPage({ cms: cms(withAdmin({ templates: false })), server: stop, tab: "templates" }),
		).rejects.toThrow("not-found");
		expect(stop.notFound).toHaveBeenCalled();
	});

	it("opens the templates tab by default", async () => {
		const stop = server();
		await expect(SettingsPage({ cms: cms(testSite), server: stop, tab: "templates" })).resolves.toBeTruthy();
		expect(stop.notFound).not.toHaveBeenCalled();
	});

	it("sends the bare settings address to the first tab", async () => {
		await expect(SettingsPage({ cms: cms(testSite), server: server(), tab: undefined })).rejects.toThrow(
			`redirect:${testSite.adminHref("/settings/collections")}`,
		);
	});

	it("is a 404 for a tab nobody owns, and for the old top-level addresses' names", async () => {
		for (const tab of ["nope", "schema"]) {
			await expect(SettingsPage({ cms: cms(testSite), server: server(), tab })).rejects.toThrow("not-found");
		}
	});
});
