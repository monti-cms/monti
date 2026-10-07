import { type AnyCmsConfig, createSite } from "@monti-cms/core/client";
import type { Cms } from "@monti-cms/core/runtime";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testConfig, testSite } from "../../../../core/test/site";
import type { AdminServer } from "../../host/server";
import { renderInRouter } from "../../test/router";
import { SidebarProvider } from "../../ui/sidebar";
import { AdminSidebar } from "../admin-sidebar";
import { screensMessages } from "../messages";
import TemplatesPage from "../templates/page";
import { withSite } from "./site-wrapper";

vi.mock("../require-admin", () => ({ requireAdminPage: async () => undefined }));
vi.mock("../templates/template-manager", () => ({ TemplateManager: () => <p>templates screen</p> }));

afterEach(cleanup);

const withAdmin = (admin: Record<string, unknown>) =>
	createSite({ ...testConfig, admin: { ...testConfig.admin, ...admin } } as AnyCmsConfig);
const link = (label: string) => screen.queryByRole("link", { name: label });
const renderSidebar = (site = testSite) =>
	renderInRouter(
		withSite(
			<SidebarProvider>
				<AdminSidebar activeNav={site.DEFAULT_COLLECTION} />
			</SidebarProvider>,
			site,
		),
	);

describe("sidebar", () => {
	it("links to the templates screen by default", () => {
		renderSidebar();
		expect(link(testSite.createTranslator(screensMessages)("sidebar.templates"))).toBeTruthy();
	});

	it("has no templates link when the site turns templates off, and keeps the other links", () => {
		renderSidebar(withAdmin({ templates: false }));
		const t = testSite.createTranslator(screensMessages);
		expect(link(t("sidebar.templates"))).toBeNull();
		expect(link(t("sidebar.schema"))).toBeTruthy();
	});
});

describe("templates screen", () => {
	const cms = (site: typeof testSite) => ({ site }) as unknown as Cms;
	const server = (): AdminServer => ({
		redirect: vi.fn(() => {
			throw new Error("redirect");
		}),
		notFound: vi.fn(() => {
			throw new Error("not-found");
		}),
	});

	it("is a 404 when the site turns templates off", async () => {
		const stop = server();
		await expect(TemplatesPage({ cms: cms(withAdmin({ templates: false })), server: stop })).rejects.toThrow(
			"not-found",
		);
		expect(stop.notFound).toHaveBeenCalled();
	});

	it("opens by default", async () => {
		const stop = server();
		await expect(TemplatesPage({ cms: cms(testSite), server: stop })).resolves.toBeTruthy();
		expect(stop.notFound).not.toHaveBeenCalled();
	});
});
