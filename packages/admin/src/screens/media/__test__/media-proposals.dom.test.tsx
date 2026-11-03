import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { AdminComponentsProvider, type MediaProposalItem, type MediaProposals } from "../../../admin-components";
import { proposalMarksMessages } from "../../../editor/proposals/messages";
import { SiteWrapper } from "../../../test/site";
import { MEDIA_PROPOSAL_ATTRIBUTE, type MediaProposalCards, useMediaProposalCards } from "../media-proposals";
import { mediaMessages } from "../messages";

const t = testSite.createTranslator(proposalMarksMessages);
const tm = testSite.createTranslator(mediaMessages);

const item = (id: string, mediaId: string, value: string): MediaProposalItem => ({
	id,
	request: "alt texts",
	mediaId,
	before: null,
	value,
});

let latest: MediaProposalCards | null = null;

/** The hook, with a tile cell per proposal for the card to hang from. */
function Library({ ids }: { ids: readonly string[] }) {
	const cards = useMediaProposalCards();
	latest = cards;
	return (
		<>
			{cards.bar}
			{ids.map((id) => (
				<span key={id} {...{ [MEDIA_PROPOSAL_ATTRIBUTE]: id }}>
					{cards.proposalFor(id)}
				</span>
			))}
			{cards.card}
		</>
	);
}

const setUp = (onAsk?: MediaProposals["onAsk"]) => {
	const items = [item("p1", "m1", "A desk by the window."), item("p2", "m2", "A night street.")];
	const onAccept = vi.fn();
	const onDiscard = vi.fn();
	const source: MediaProposals = { items, onAccept, onDiscard, ...(onAsk ? { onAsk } : {}) };
	render(
		<SiteWrapper>
			<AdminComponentsProvider components={{ mediaProposals: () => source }}>
				<Library ids={["m1", "m2", "m3"]} />
			</AdminComponentsProvider>
		</SiteWrapper>,
	);
	return { items, onAccept, onDiscard };
};

describe("proposals on the media tiles", () => {
	it("ASSIST-E6 draws each file's proposed alt text, and the toolbar accepts or discards them all", () => {
		const { items, onAccept, onDiscard } = setUp();
		expect(latest?.proposalFor("m1")).toBe("A desk by the window.");
		expect(latest?.proposalFor("m3")).toBeUndefined();
		expect(screen.getByRole("toolbar", { name: tm("proposal.count", { count: 2 }) })).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: t("acceptAll") }));
		expect(onAccept).toHaveBeenCalledWith(items);
		fireEvent.click(screen.getByRole("button", { name: t("discardAll") }));
		expect(onDiscard).toHaveBeenCalledWith(items);
	});

	it("ASSIST-E6 opens a tile's card, which accepts that one file's alt text", async () => {
		const { items, onAccept } = setUp();
		act(() => latest?.open("m2"));
		expect(await screen.findByRole("dialog")).toHaveTextContent(tm("proposal.where"));
		fireEvent.click(screen.getByRole("button", { name: t("accept") }));
		expect(onAccept).toHaveBeenCalledWith([items[1]]);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});

	it("ASSIST-E6 keeps a request stopped in a tile's card in it, marked stopped", async () => {
		const onAsk = vi.fn(
			(_item: MediaProposalItem, _text: string, signal: AbortSignal) =>
				new Promise<string | null>((_resolve, reject) => {
					signal.addEventListener("abort", () => reject(new DOMException("Stopped", "AbortError")));
				}),
		);
		setUp(onAsk);
		act(() => latest?.open("m1"));
		const box = await screen.findByRole("textbox", { name: t("reply") });
		fireEvent.change(box, { target: { value: "no coffee" } });
		fireEvent.keyDown(box, { key: "Enter" });
		fireEvent.click(await screen.findByRole("button", { name: t("stop") }));
		await waitFor(() => expect(screen.getByRole("dialog")).toHaveTextContent(t("stopped")));
		expect(screen.getByRole("dialog")).toHaveTextContent("no coffee");
		expect(onAsk.mock.lastCall?.[2].aborted).toBe(true);
	});
});
