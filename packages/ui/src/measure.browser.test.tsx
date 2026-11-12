import { composeStories, setProjectAnnotations } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { measure } from "../../../testing/measure";
import { measureStories } from "../../../testing/measure-stories";
import preview from "../.storybook/preview";
import { render } from "../test/render";

// The page the stories have: the admin root around each, with its tokens.
setProjectAnnotations(preview);

describe("the measuring itself", () => {
	const lines = async (name: string) => {
		await expect.element(page.getByRole("button", { name })).toBeVisible();
		await userEvent.keyboard("{Shift}");
		return measure().filter((line) => line.includes(`"${name}"`));
	};
	const RING = "outline-none focus-visible:ring-2 focus-visible:ring-monti-contrast/50";

	it("a control at a height, pressable over 24px, a pill, its ring whole: nothing to say", async () => {
		render(
			<div className="p-monti-8">
				<button type="button" className={`h-monti-control-sm rounded-monti-full bg-monti-selected ${RING}`}>
					좋음
				</button>
			</div>,
		);
		expect(await lines("좋음")).toEqual([]);
	});

	it("a height made of padding, a low pressable thing, an odd corner and a ring cut by a clipping box are each said", async () => {
		render(
			<div className="flex flex-col items-start gap-monti-16 p-monti-8">
				<button type="button" className="rounded-monti-full bg-monti-selected py-[7px] text-monti-note leading-5">
					높이
				</button>
				<button type="button" className="h-4 border-0 bg-transparent p-0 text-monti-caption leading-4">
					낮음
				</button>
				<button type="button" className="h-monti-control-sm rounded-[4px] bg-monti-selected">
					모서리
				</button>
				<div className="overflow-hidden">
					<button type="button" className={`h-monti-control-sm rounded-monti-full bg-monti-selected ${RING}`}>
						잘림
					</button>
				</div>
				<div className="overflow-hidden">
					<button
						type="button"
						className={`h-monti-control-sm rounded-monti-full bg-monti-selected ring-inset ${RING}`}
					>
						안쪽
					</button>
				</div>
			</div>,
		);
		expect(await lines("높이")).toEqual(['height: button "높이" is 34px high; a control is 24, 28, 32 or 36']);
		expect(await lines("낮음")).toEqual(['hit: button "낮음" is pressable over 16px; at least 24 (HIT_AREA)']);
		expect(await lines("모서리")).toEqual(['corner: button "모서리" has 4px corners; a pill, 6px or none']);
		expect(await lines("잘림")).toEqual([
			'ring: the focus ring of button "잘림" is cut at its left and right and top and bottom by div',
		]);
		// A ring drawn inside the box is whole in a box that clips.
		expect(await lines("안쪽")).toEqual([]);
	});
	it("what a first reading of the page would miss is said too", async () => {
		render(
			<div className="flex flex-col items-start gap-monti-16 p-monti-8">
				<button type="button" className="h-10 rounded-monti-full bg-monti-selected px-monti-12">
					높은 상자
				</button>
				<div className="flex h-monti-control-sm items-center">
					<button type="button" className="h-[30px] rounded-monti-full bg-monti-selected">
						남의 상자 안
					</button>
				</div>
				<button type="button" className="h-monti-control-sm rounded-[4px] border-0 bg-[black] text-monti-on-emphasis">
					검은 바탕
				</button>
				<button
					type="button"
					className="h-monti-control-sm rounded-[4px] border-0 bg-transparent hover:bg-monti-selected"
				>
					가리킬 때 바탕
				</button>
				<button type="button" className="h-monti-control-sm rounded-tl-monti-md rounded-tr-[4px] bg-monti-selected">
					한 모서리
				</button>
				<div className="h-4 overflow-hidden">
					<button
						type="button"
						className="relative block h-4 border-0 bg-transparent p-0 text-monti-caption leading-4 outline-none after:absolute after:inset-x-0 after:top-1/2 after:h-6 after:-translate-y-1/2 after:content-[''] focus-visible:ring-2 focus-visible:ring-monti-contrast/50 focus-visible:ring-inset"
					>
						잘린 층
					</button>
				</div>
				<div role="menu" className="overflow-hidden">
					<div role="menuitem" tabIndex={-1} className={`h-monti-control-md ${RING}`}>
						화살표로 닿는 줄
					</div>
				</div>
				<div className="relative overflow-hidden p-monti-4">
					<button
						type="button"
						className="h-monti-control-sm border-0 bg-transparent outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-monti-contrast/50"
					>
						층의 고리
					</button>
				</div>
				<div className="overflow-hidden">
					<button
						type="button"
						className="h-monti-control-sm rounded-monti-full bg-monti-selected outline-2 outline-transparent outline-offset-2"
					>
						안 보이는 선
					</button>
				</div>
			</div>,
		);
		const said = async (name: string) => (await lines(name)).map((line) => line.split(":")[0]);
		expect(await said("높은 상자")).toEqual(["height"]);
		expect(await said("남의 상자 안")).toEqual(["height"]);
		expect(await said("검은 바탕")).toEqual(["corner"]);
		expect(await said("가리킬 때 바탕")).toEqual(["corner"]);
		expect(await said("한 모서리")).toEqual(["corner"]);
		expect(await said("잘린 층")).toEqual(["hit"]);
		await expect.element(page.getByRole("menuitem")).toBeVisible();
		expect(
			measure()
				.filter((line) => line.includes("화살표로 닿는 줄"))
				.map((line) => line.split(":")[0]),
		).toEqual(["ring"]);
		expect(await said("층의 고리")).toEqual(["ring"]);
		// An outline that draws nothing is not a ring to cut; that the focus then draws nothing is said.
		expect(await said("안 보이는 선")).toEqual(["focus"]);
	});

	it("a keyboard focus that draws nothing is said, however the ring was lost", async () => {
		const BOX = "h-monti-control-sm rounded-monti-full border-0 bg-monti-selected";
		render(
			<div className="flex flex-col items-start gap-monti-16 p-monti-8">
				{/* The text button's mistake: with Tailwind 4 `outline-none` sets the style to none, and `outline-2` only the width. */}
				<button
					type="button"
					className={`${BOX} outline-none focus-visible:outline-2 focus-visible:outline-monti-contrast/50 focus-visible:outline-offset-2`}
				>
					두께만
				</button>
				<button type="button" className={`${BOX} outline-none`}>
					아무것도
				</button>
				{/* The pointer's ground is not the keyboard's mark (tokens.md: the focus shows apart from hover). */}
				<button type="button" className={`${BOX} outline-none focus-visible:bg-monti-current`}>
					바탕만
				</button>
				{/* A state that wears the ring already: the focus adds nothing to it. */}
				<button
					type="button"
					className={`${BOX} outline-none ring-2 ring-monti-contrast focus-visible:ring-2 focus-visible:ring-monti-contrast`}
				>
					이미 두른 것
				</button>
			</div>,
		);
		const said = async (name: string) => (await lines(name)).map((line) => line.split(":")[0]);
		expect(await lines("두께만")).toEqual([
			"focus: button \"두께만\" draws nothing when the keyboard's focus is on it; a ring, or a field's ink line",
		]);
		expect(await said("아무것도")).toEqual(["focus"]);
		expect(await said("바탕만")).toEqual(["focus"]);
		expect(await said("이미 두른 것")).toEqual(["focus"]);
	});

	it("a mark that paints nothing is no mark: a clear shadow, a ring of no width, a ring on what is not drawn, a span put in on focus", async () => {
		const BOX = "h-monti-control-sm rounded-monti-full border-0 bg-monti-selected outline-none";
		/** Puts a ringed span of no size into itself when focused: the page changes, and nothing is drawn. */
		const ring = (button: HTMLButtonElement) => {
			const span = document.createElement("span");
			span.className = "ring-2 ring-monti-contrast/50";
			button.append(span);
		};
		const Appends = () => (
			<button
				type="button"
				className={BOX}
				onFocus={(event) => ring(event.currentTarget)}
				onBlur={(event) => event.currentTarget.querySelector("span")?.remove()}
			>
				넣은 것
			</button>
		);
		render(
			<div className="flex flex-col items-start gap-monti-16 p-monti-8">
				<button type="button" className={`${BOX} focus-visible:shadow-[0_0_0_2px_transparent]`}>
					맑은 그림자
				</button>
				<button type="button" className={`${BOX} focus-visible:ring-0 focus-visible:ring-monti-contrast/50`}>
					두께 없는 고리
				</button>
				<button type="button" className={`${BOX} group`}>
					안 그린 것
					<span className="hidden size-2 group-focus-visible:ring-2 group-focus-visible:ring-monti-contrast/50" />
				</button>
				<Appends />
			</div>,
		);
		const said = async (name: string) => (await lines(name)).map((line) => line.split(":")[0]);
		expect.soft(await said("맑은 그림자")).toEqual(["focus"]);
		expect.soft(await said("두께 없는 고리")).toEqual(["focus"]);
		expect.soft(await said("안 그린 것")).toEqual(["focus"]);
		expect.soft(await said("넣은 것")).toEqual(["focus"]);
	});

	it("a line around that only steps off under the focus is a mark, and one that steps off past a clipping box is cut", async () => {
		const LINE = "h-monti-control-sm rounded-monti-full border-0 bg-monti-selected outline-2 outline-monti-contrast/50";
		render(
			<div className="flex flex-col items-start gap-monti-16 p-monti-8">
				<button type="button" className={`${LINE} focus-visible:outline-offset-2`}>
					물러난 선
				</button>
				{/* Room for the line as it stands, not for the line 2px off. */}
				<div className="overflow-hidden p-[2px]">
					<button type="button" className={`${LINE} focus-visible:outline-offset-2`}>
						물러나 잘린 선
					</button>
				</div>
			</div>,
		);
		expect.soft(await lines("물러난 선")).toEqual([]);
		expect(await lines("물러나 잘린 선")).toEqual([
			'ring: the focus ring of button "물러나 잘린 선" is cut at its left and right and top and bottom by div',
		]);
	});

	it("what unfolds in place is asked for its focus while it is open; a trigger whose popup is open is not", async () => {
		const BOX = "h-monti-control-sm rounded-monti-full border-0 bg-monti-selected outline-none";
		render(
			<div className="flex flex-col items-start gap-monti-16 p-monti-8">
				<button type="button" aria-expanded="true" className={BOX}>
					펼친 것
				</button>
				<button type="button" aria-expanded="true" aria-haspopup="menu" className={BOX}>
					메뉴를 연 것
				</button>
			</div>,
		);
		const said = async (name: string) => (await lines(name)).map((line) => line.split(":")[0]);
		expect(await said("펼친 것")).toEqual(["focus"]);
		expect(await said("메뉴를 연 것")).toEqual([]);
	});

	it("a focus drawn as the docs draw it is not said: a line around, a field's ink line, a ring on the box around or on what is inside, a caret", async () => {
		const BOX = "h-monti-control-sm rounded-monti-full border-0 bg-monti-selected";
		render(
			<div className="flex flex-col items-start gap-monti-16 p-monti-8">
				<button
					type="button"
					className={`${BOX} focus-visible:outline-2 focus-visible:outline-monti-contrast/50 focus-visible:outline-offset-2`}
				>
					둘레 선
				</button>
				<button
					type="button"
					className="h-monti-control-sm rounded-none border-0 border-monti-default border-b bg-transparent outline-none focus-visible:border-monti-contrast"
				>
					밑줄
				</button>
				<div className="rounded-monti-full has-focus-visible:ring-2 has-focus-visible:ring-monti-contrast/50">
					<button type="button" className={`${BOX} outline-none`}>
						감싼 상자의 고리
					</button>
				</div>
				<button
					type="button"
					className="flex h-monti-control-sm border-0 bg-transparent p-0 outline-none focus-visible:*:first:ring-2 focus-visible:*:first:ring-monti-contrast/50"
				>
					<span className="rounded-monti-full bg-monti-selected">안쪽의 고리</span>
				</button>
				<div className="flex h-monti-control-sm items-center border-monti-default border-b focus-within:border-monti-contrast">
					<input aria-label="칸" className="border-0 bg-transparent outline-none" />
				</div>
				{/* An error's red line stays under the focus: what is typed in has its caret. */}
				<div className="flex h-monti-control-sm items-center border-monti-danger border-b">
					<input aria-label="틀린 칸" className="border-0 bg-transparent outline-none" />
				</div>
			</div>,
		);
		for (const name of ["둘레 선", "밑줄", "감싼 상자의 고리", "안쪽의 고리"]) expect(await lines(name)).toEqual([]);
		await expect.element(page.getByRole("textbox", { name: "틀린 칸" })).toBeVisible();
		expect(measure().filter((line) => line.startsWith("focus"))).toEqual([]);
	});
});

measureStories(import.meta.glob("./**/*.stories.tsx", { eager: true }), composeStories);
