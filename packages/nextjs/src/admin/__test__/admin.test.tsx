import { useAdminPathname, useAdminRouter, useAdminSearchParams } from "@monti-cms/admin/router";
import { defineCollection, defineConfig, fields } from "@monti-cms/core";
import { AuthError } from "@monti-cms/core/runtime";
import { fakeCms } from "@monti-cms/core/testing";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { isValidElement, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CmsAdminPage, cmsAdminMetadata, NextAdminRouter } from "..";

const next = vi.hoisted(() => ({
	push: vi.fn(),
	replace: vi.fn(),
	pathname: "/admin/trash",
	search: "collection=post",
}));
vi.mock("next/navigation", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/navigation")>()),
	useRouter: () => ({ push: next.push, replace: next.replace }),
	usePathname: () => next.pathname,
	useSearchParams: () => new URLSearchParams(next.search),
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

function Probe() {
	const router = useAdminRouter();
	return (
		<div>
			<output aria-label="where">{`${useAdminPathname()}?${useAdminSearchParams().toString()}`}</output>
			<router.Link href="/admin/media">Media</router.Link>
			<button type="button" onClick={() => router.navigate("/admin/entries/new")}>
				new
			</button>
			<button type="button" onClick={() => router.replace("/admin?collection=tag", { scroll: false })}>
				filter
			</button>
		</div>
	);
}

describe("NextAdminRouter", () => {
	it("gives the admin Next's address and a link to an address inside the site", () => {
		render(
			<NextAdminRouter>
				<Probe />
			</NextAdminRouter>,
		);
		expect(screen.getByLabelText("where").textContent).toBe("/admin/trash?collection=post");
		expect(screen.getByRole("link", { name: "Media" }).getAttribute("href")).toBe("/admin/media");
	});

	it("navigates through Next's router: push for a new history entry, replace with its options", () => {
		render(
			<NextAdminRouter>
				<Probe />
			</NextAdminRouter>,
		);
		fireEvent.click(screen.getByRole("button", { name: "new" }));
		expect(next.push).toHaveBeenCalledWith("/admin/entries/new", undefined);
		fireEvent.click(screen.getByRole("button", { name: "filter" }));
		expect(next.replace).toHaveBeenCalledWith("/admin?collection=tag", { scroll: false });
	});
});

describe("CmsAdminPage", () => {
	/**
	 * Renders server components the way Next does: calls the component, then the component of the element it returns, for the three levels
	 * between the route file and a screen (`CmsAdminPage`, `AdminPage`, the screen). A redirect or a 404 is thrown on the way.
	 */
	const run = async (element: ReactElement, levels = 3): Promise<unknown> => {
		const { type, props } = element as unknown as { type: (props: unknown) => unknown; props: unknown };
		const result = await type(props);
		return levels > 1 && isValidElement(result) ? run(result, levels - 1) : result;
	};
	const page = (path: string[], cms = fakeCms()) =>
		run(<CmsAdminPage cms={cms} params={Promise.resolve({ path })} searchParams={Promise.resolve({})} />);

	it("answers 404 through Next's notFound for a path no screen handles", async () => {
		await expect(page(["entries", "a", "b", "c"])).rejects.toMatchObject({
			digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK;404"),
		});
	});

	it("sends a visitor who is not signed in to the login screen through Next's redirect", async () => {
		const cms = fakeCms({
			verifyAdmin: async () => {
				throw new AuthError("unauthorized", "Authentication required");
			},
		});
		await expect(page(["media"], cms)).rejects.toMatchObject({
			digest: expect.stringMatching(/^NEXT_REDIRECT;[a-z]+;\/admin\/login;/),
		});
	});
});

describe("cmsAdminMetadata", () => {
	it("titles the admin pages and keeps them out of search results", () => {
		const metadata = cmsAdminMetadata(fakeCms());
		expect(metadata.title).toBeTruthy();
		expect(metadata.robots).toEqual({ index: false, follow: false });
	});

	it("puts the name of the instance's site in the title", () => {
		const cms = fakeCms({
			config: defineConfig({
				collections: {
					page: defineCollection({
						label: "Page",
						kind: "document",
						fields: { title: fields.text({ label: "Title", required: true }) },
					}),
				},
				locales: [{ code: "en", name: "English" }],
				defaultLocale: "en",
				site: { name: "Acme" },
			}),
		});
		expect(cmsAdminMetadata(cms).title).toContain("Acme");
	});
});
