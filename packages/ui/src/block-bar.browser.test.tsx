import { expect, it } from "vitest";
import { render } from "../test/render";
import { BlockBox } from "./block-bar";
import { FileBlock } from "./file-block";

it("a picked box draws its own line only: a file or a picture inside a picked block keeps its own look and draws no second line", async () => {
	const host = render(
		<BlockBox selected>
			<div>
				<BlockBox>
					<FileBlock name="notes.pdf" meta="PDF · 1.2 MB" />
				</BlockBox>
			</div>
		</BlockBox>,
	);
	await expect.poll(() => host.querySelectorAll("[data-slot=block-box]").length).toBe(2);
	const [outer, inner] = [...host.querySelectorAll("[data-slot=block-box]")] as HTMLElement[];
	const line = (box: HTMLElement | undefined) => box?.querySelector(":scope > [data-slot=block-line]") as HTMLElement;
	expect(getComputedStyle(line(outer)).outlineWidth).toBe("2px");
	expect(getComputedStyle(line(inner)).display).toBe("none");
	const file = host.querySelector("[data-slot=file-block]") as HTMLElement;
	expect(getComputedStyle(file).borderTopColor).not.toBe("rgba(0, 0, 0, 0)");
});

it("a file in its own picked box steps its border aside under the box's line", async () => {
	const host = render(
		<BlockBox selected>
			<FileBlock name="notes.pdf" meta="PDF · 1.2 MB" />
		</BlockBox>,
	);
	await expect.poll(() => host.querySelector("[data-slot=file-block]")).not.toBeNull();
	const file = host.querySelector("[data-slot=file-block]") as HTMLElement;
	expect(getComputedStyle(file).borderTopColor).toBe("rgba(0, 0, 0, 0)");
});
