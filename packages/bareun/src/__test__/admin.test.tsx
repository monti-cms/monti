import { AdminComponentsProvider, useAdminComponents } from "@monti-cms/admin";
import { SiteProvider } from "@monti-cms/core/site";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type EditorStatus, StatusBar, StatusItemsProvider } from "../../../admin/src/screens/shared/status-bar";
import { SiteWrapper } from "../../../admin/src/test/site";
import { testSite } from "../../test/site";
import bareunAdmin from "../admin";
import { bareun } from "../index";

afterEach(cleanup);

function Checkers() {
	const { textCheckers = [] } = useAdminComponents();
	return <p>{textCheckers.map((checker) => checker.id).join(",")}</p>;
}

describe("Bareun checker admin side", () => {
	it("declares Bareun as the admin text checker, made from the site config values", () => {
		const { components } = bareunAdmin;
		expect(typeof components).toBe("function");
		if (typeof components !== "function") return;
		render(
			<SiteProvider site={testSite}>
				<AdminComponentsProvider components={components(testSite)}>
					<Checkers />
				</AdminComponentsProvider>
			</SiteProvider>,
		);
		expect(screen.getByText("bareun")).toBeTruthy();
	});

	it("the plugin definition fills in defaults and rejects invalid values", () => {
		const plugin = bareun();
		expect(plugin.name).toBe("text-check-bareun");
		expect(typeof plugin.server).toBe("function");
		expect(typeof plugin.admin).toBe("function");
		expect(plugin.nav ?? []).toEqual([]);
		expect(bareunAdmin.pages ?? {}).toEqual({});
		expect(() => bareun({ baseUrl: "ftp://x" })).toThrow();
		expect(() => bareun({ limits: { maxChars: 0 } })).toThrow();
	});

	describe("status bar item", () => {
		const editorStatus = (textIssues: EditorStatus["textIssues"]): EditorStatus => ({
			saveStatus: "saved",
			savedAt: null,
			statusLabel: "Draft",
			charCount: 0,
			readingMinutes: 1,
			backupAvailable: true,
			save: () => {},
			textIssues,
		});
		const showBar = (textIssues: EditorStatus["textIssues"]) => {
			vi.stubGlobal(
				"fetch",
				vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })),
			);
			const { statusItems } = bareunAdmin;
			if (!statusItems || typeof statusItems === "function") throw new Error("statusItems is a plain record");
			render(
				<SiteWrapper site={testSite}>
					<StatusItemsProvider items={statusItems}>
						<StatusBar context={{ screen: "entry", editor: editorStatus(textIssues) }} />
					</StatusItemsProvider>
				</SiteWrapper>,
			);
		};

		it("counts the findings of the body, and goes to the first one when clicked", () => {
			const jumpToFirst = vi.fn();
			showBar({ count: 3, jumpToFirst });
			fireEvent.click(screen.getByRole("button", { name: "맞춤법 3건" }));
			expect(jumpToFirst).toHaveBeenCalledTimes(1);
		});

		it("is hidden when there is nothing to fix or no checker covers the text", () => {
			showBar({ count: 0, jumpToFirst: () => {} });
			expect(screen.queryByRole("button", { name: /맞춤법/ })).toBeNull();
			cleanup();
			showBar(null);
			expect(screen.queryByRole("button", { name: /맞춤법/ })).toBeNull();
		});
	});
});
