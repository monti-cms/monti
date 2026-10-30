import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestRouter } from "../../test/router";
import { AdminLink, useAdminPathname, useAdminRouter, useAdminSearchParams } from "..";

afterEach(cleanup);

function Probe() {
	const pathname = useAdminPathname();
	const search = useAdminSearchParams();
	const router = useAdminRouter();
	return (
		<div>
			<output aria-label="where">{`${pathname}?${search.toString()}`}</output>
			<AdminLink href="/admin/trash">Trash</AdminLink>
			<button type="button" onClick={() => router.navigate("/admin/media")}>
				go
			</button>
			<button type="button" onClick={() => router.replace("/admin?collection=tag", { scroll: false })}>
				swap
			</button>
		</div>
	);
}

describe("admin router", () => {
	it("draws links with the host's Link and reads the address through the host's hooks", () => {
		const host = createTestRouter({ pathname: "/admin/templates", search: "collection=post" });
		host.render(<Probe />);
		expect(screen.getByLabelText("where").textContent).toBe("/admin/templates?collection=post");
		expect(screen.getByRole("link", { name: "Trash" }).getAttribute("href")).toBe("/admin/trash");
	});

	it("navigates and replaces through the host, and re-renders when the host's address changes", () => {
		const host = createTestRouter({ pathname: "/admin" });
		host.render(<Probe />);
		fireEvent.click(screen.getByRole("button", { name: "go" }));
		expect(host.navigate).toHaveBeenCalledWith("/admin/media");
		fireEvent.click(screen.getByRole("button", { name: "swap" }));
		expect(host.replace).toHaveBeenCalledWith("/admin?collection=tag", { scroll: false });
		expect(screen.getByLabelText("where").textContent).toBe("/admin?collection=tag");
		act(() => host.setSearch("collection=post"));
		expect(screen.getByLabelText("where").textContent).toBe("/admin?collection=post");
	});

	it("fails with a message that names the missing provider when there is none", () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(() => render(<Probe />)).toThrow(/AdminRouterProvider/);
		log.mockRestore();
	});
});
