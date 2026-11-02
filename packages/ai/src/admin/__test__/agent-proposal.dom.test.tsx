import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestRouter } from "../../../../admin/src/test/router";
import { SiteWrapper } from "../../../../admin/src/test/site";
import { testSite } from "../../../test/site";
import type { ProposalView } from "../../agent/proposal-view";
import { AgentProposal } from "../agent-proposal";
import { proposalMessages } from "../proposal.messages";
import { ProposalReviewScreen } from "../proposal-review";

const t = testSite.createTranslator(proposalMessages);
const { render } = createTestRouter();

const item = (id: string, extra: Partial<ProposalView["items"][number]> = {}): ProposalView["items"][number] => ({
	id,
	operation: "entries.moveToFolder",
	target: { kind: "entry", id: `e-${id}`, spot: "folder" },
	preview: { before: null, after: "f2024" },
	subject: { title: `Post ${id}`, path: `/${id}` },
	shown: { before: null, after: "2024" },
	included: true,
	state: "pending",
	...extra,
});
const PROPOSAL: ProposalView = {
	id: "p1",
	runId: "r1",
	request: "move last year's posts",
	status: "pending",
	createdAt: "2026-11-03T10:51:00.000Z",
	items: [item("a"), item("b"), item("c")],
};

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
const lines = (...rows: unknown[]) =>
	new Response(rows.map((row) => `${JSON.stringify(row)}\n`).join(""), {
		headers: { "content-type": "application/x-ndjson" },
	});

let server: { proposal: ProposalView; patches: unknown[]; posts: string[] };
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
	server = { proposal: PROPOSAL, patches: [], posts: [] };
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		const url = String(input);
		if (url.endsWith("/apply")) {
			server.posts.push("apply");
			const applied: ProposalView = {
				...server.proposal,
				status: "partial",
				settledAt: "2026-11-03T10:52:00.000Z",
				items: server.proposal.items.map((entry) =>
					entry.id === "c" ? { ...entry, state: "failed", reason: "invalid_status" } : { ...entry, state: "applied" },
				),
			};
			server.proposal = applied;
			return lines(
				{ type: "progress", done: 1, total: 3 },
				{ type: "progress", done: 3, total: 3 },
				{ type: "done", proposal: applied },
			);
		}
		if (url.endsWith("/revert")) {
			server.posts.push("revert");
			server.proposal = { ...server.proposal, status: "reverted", settledAt: "2026-11-03T10:53:00.000Z" };
			return lines({ type: "done", proposal: server.proposal });
		}
		if (url.includes("/v1/ai/proposals/") && init?.method === "PATCH") {
			const body = JSON.parse(String(init.body)) as { include: Record<string, boolean> };
			server.patches.push(body.include);
			server.proposal = {
				...server.proposal,
				items: server.proposal.items.map((entry) =>
					Object.hasOwn(body.include, entry.id) ? { ...entry, included: Boolean(body.include[entry.id]) } : entry,
				),
			};
			return json(server.proposal);
		}
		if (url.includes("/v1/ai/proposals/")) return json(server.proposal);
		throw new Error(`Unexpected fetch: ${url}`);
	});
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("proposal card", () => {
	it("ASSIST-R1 shows the groups of a waiting proposal, applies it, then shows what was applied and what was not, and undoes it", async () => {
		render(
			<SiteWrapper>
				<AgentProposal initial={PROPOSAL} />
			</SiteWrapper>,
		);
		const card = await screen.findByTestId("agent-proposal");
		expect(within(card).getByText(t("group.move", { folder: "2024" }))).toBeInTheDocument();
		fireEvent.click(within(card).getByRole("button", { name: t("apply", { count: 3 }) }));
		await within(card).findByText(t("applied", { count: 2 }));
		expect(within(card).getByText(t("failed", { count: 1 }))).toBeInTheDocument();
		expect(within(card).getByText(t("reason.gone"))).toBeInTheDocument();
		fireEvent.click(within(card).getByRole("button", { name: t("undo") }));
		await within(card).findByText(t("status.reverted", { time: "10:53" }).split(" · ")[0] ?? "", { exact: false });
		expect(server.posts).toEqual(["apply", "revert"]);
	});

	it("ASSIST-R1 lists the first files of a long card of new alt texts and sends the rest to the review page", async () => {
		const alt = (id: string) =>
			item(id, {
				operation: "media.updateText",
				target: { kind: "media", id: `m-${id}`, spot: "alt" },
				preview: { before: null, after: `Alt ${id}` },
				subject: { title: `${id}.jpg` },
				shown: undefined,
			});
		const files = ["a", "b", "c", "d", "e"].map(alt);
		server.proposal = { ...PROPOSAL, items: files };
		render(
			<SiteWrapper>
				<AgentProposal initial={server.proposal} />
			</SiteWrapper>,
		);
		const card = await screen.findByTestId("agent-proposal");
		expect(within(card).getByText("c.jpg")).toBeInTheDocument();
		expect(within(card).queryByText("d.jpg")).not.toBeInTheDocument();
		expect(within(card).getByText(t("moreFiles", { count: 2 }))).toBeInTheDocument();
		expect(within(card).getByRole("button", { name: t("review") })).toBeInTheDocument();
	});
});

describe("proposal review", () => {
	it("ASSIST-R2 lists each change with a check, leaves one out on the server, and applies only what is included", async () => {
		server.proposal = { ...PROPOSAL, items: [item("a"), item("b"), item("c", { state: "stale", reason: "changed" })] };
		render(
			<SiteWrapper>
				<ProposalReviewScreen params={["p1"]} />
			</SiteWrapper>,
		);
		const page = await screen.findByTestId("proposal-review");
		await within(page).findByText("Post a");
		expect(within(page).getByText(t("review.stale"))).toBeInTheDocument();
		const checks = within(page).getAllByRole("checkbox", { name: t("review.include") });
		expect(checks.map((check) => check.getAttribute("aria-checked"))).toEqual(["true", "true", "false"]);
		fireEvent.click(checks[1] as HTMLElement);
		await waitFor(() => expect(server.patches).toEqual([{ b: false }]));
		await within(page).findByRole("button", { name: t("apply", { count: 1 }) });
	});

	it("ASSIST-R2 keeps the checks of an applied proposal read-only: clicking one changes nothing", async () => {
		server.proposal = {
			...PROPOSAL,
			status: "applied",
			settledAt: "2026-11-03T10:52:00.000Z",
			items: [item("a", { state: "applied" }), item("b", { state: "applied" })],
		};
		render(
			<SiteWrapper>
				<ProposalReviewScreen params={["p1"]} />
			</SiteWrapper>,
		);
		const page = await screen.findByTestId("proposal-review");
		await within(page).findByText("Post a");
		const [first] = within(page).getAllByRole("checkbox", { name: t("review.include") });
		expect(first).toHaveAttribute("aria-readonly", "true");
		fireEvent.click(first as HTMLElement);
		expect(first).toHaveAttribute("aria-checked", "true");
		expect(server.patches).toEqual([]);
		expect(within(page).queryByRole("button", { name: t("apply", { count: 0 }) })).not.toBeInTheDocument();
	});
});
