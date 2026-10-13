import { type AnyCmsConfig, createSite } from "@monti-cms/core/client";
import type { Cms } from "@monti-cms/core/runtime";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testConfig, testSite } from "../../../../core/test/site";
import type { AdminServer } from "../../host/server";
import SettingsPage from "../settings/page";
import { settingsTabs } from "../settings/tabs";
import TemplatesPage from "../templates/page";

vi.mock("../require-admin", () => ({ requireAdminPage: async () => undefined }));
vi.mock("../settings/settings-screen", () => ({ SettingsScreen: () => <p>settings screen</p> }));
vi.mock("../templates/templates-screen", () => ({ TemplatesScreen: () => <p>templates screen</p> }));

afterEach(cleanup);

const withAdmin = (admin: Record<string, unknown>) =>
	createSite({ ...testConfig, admin: { ...testConfig.admin, ...admin } } as AnyCmsConfig);
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
	it("are the schema file's tabs; templates, the event log and plugin pages are not among them", () => {
		const ids = settingsTabs(testSite).map((tab) => tab.id);
		expect(ids).toEqual(["collections", "locales", "site", "admin", "file"]);
	});
});

describe("settings page", () => {
	it("sends the bare settings address to the first tab", async () => {
		await expect(SettingsPage({ cms: cms(testSite), server: server(), tab: undefined })).rejects.toThrow(
			`redirect:${testSite.adminHref("/settings/collections")}`,
		);
	});

	it("opens a schema tab", async () => {
		const stop = server();
		await expect(SettingsPage({ cms: cms(testSite), server: stop, tab: "locales" })).resolves.toBeTruthy();
		expect(stop.notFound).not.toHaveBeenCalled();
	});

	it("is a 404 for a tab nobody owns, including the screens that used to be tabs", async () => {
		for (const tab of ["nope", "schema", "templates", "events", "ai"]) {
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
