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
						className="relative block h-4 border-0 bg-transparent p-0 text-monti-caption leading-4 outline-none after:absolute after:inset-x-0 after:top-1/2 after:h-6 after:-translate-y-1/2 after:content-['']"
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
		// An outline that draws nothing is not a ring to cut.
		expect(await said("안 보이는 선")).toEqual([]);
	});
});

measureStories(import.meta.glob("./**/*.stories.tsx", { eager: true }), composeStories);
