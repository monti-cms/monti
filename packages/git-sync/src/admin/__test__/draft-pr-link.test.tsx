// @vitest-environment jsdom

import { createSite, SiteProvider } from "@monti-cms/core/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import config from "../../../test/cms.config";
import { useDraftPrExtension } from "../draft-pr-link";
import { gitSyncMessages } from "../page.messages";

const site = createSite(config);
const t = site.createTranslator(gitSyncMessages);

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

let items: unknown[];
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	items = [];
	fetchMock = vi.fn(async () => json({ items }));
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

/** What the edit screen does with an extension: calls it as a hook and renders its toolbar. */
function Toolbar({ entryId }: { entryId?: string }) {
	const { toolbar } = useDraftPrExtension({
		translateLocales: null,
		getEntry: () => ({ title: "Hello", collection: "memo", ...(entryId ? { entryId } : {}) }),
	});
	return <div>{toolbar}</div>;
}

const renderToolbar = (entryId?: string) =>
	render(
		<SiteProvider site={site}>
			<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
				<Toolbar entryId={entryId} />
			</QueryClientProvider>
		</SiteProvider>,
	);

describe("the Draft PR link on the entry page", () => {
	it("links to the draft pull request of the entry when there is one", async () => {
		items = [{ entryId: "e1", number: 7, url: "https://github.com/acme/site/pull/7" }];
		renderToolbar("e1");
		const link = await screen.findByRole("link", { name: t("draftPr.link") });
		expect(link.getAttribute("href")).toBe("https://github.com/acme/site/pull/7");
		expect(link.getAttribute("target")).toBe("_blank");
		expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/cms/v1/git-sync/drafts?entryId=e1");
	});

	it("shows nothing when the entry has no draft pull request, and asks nothing for an entry that is not saved yet", async () => {
		renderToolbar("e1");
		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
		expect(screen.queryByRole("link")).toBeNull();
		cleanup();
		fetchMock.mockClear();
		renderToolbar();
		expect(screen.queryByRole("link")).toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("shows nothing when the request fails", async () => {
		fetchMock.mockImplementation(async () => json({ code: "forbidden" }, 403));
		renderToolbar("e1");
		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
		expect(screen.queryByRole("link")).toBeNull();
	});
});
