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
});

measureStories(import.meta.glob("./**/*.stories.tsx", { eager: true }), composeStories);
