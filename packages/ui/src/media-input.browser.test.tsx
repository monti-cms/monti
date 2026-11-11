import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import { MediaInput } from "./index";

describe("MediaInput", () => {
	it("read-only, the field is the value to read: its line is no button, with no hand, no tint under the pointer, no × and no icon that says to choose; the control it was given stays (T125)", async () => {
		const opened = vi.fn();
		render(
			<div style={{ width: 280 }}>
				<MediaInput value={{ name: "cover-react.png" }} onOpen={opened} />
				<span id="cover-label">대표 이미지</span>
				<MediaInput
					value={{ name: "archived-cover.png" }}
					aria-labelledby="cover-label"
					readOnly
					onOpen={opened}
					onClear={opened}
					clearLabel="빼기"
					action={<button type="button">설정</button>}
				/>
			</div>,
		);
		const open = page.getByRole("button", { name: "cover-react.png" });
		await expect.element(open).toBeVisible();
		const read = page.getByText("archived-cover.png");
		await expect.element(read).toBeVisible();
		expect(read.element().closest("button")).toBeNull();
		// Not a control, so a label's `for` cannot name it: it is a group named by the label.
		await expect.element(page.getByRole("group", { name: "대표 이미지" })).toHaveTextContent("archived-cover.png");
		const field = (words: ReturnType<typeof page.getByText>) =>
			words.element().closest("[data-slot=media-input]") as HTMLElement;

		// The one to press answers the pointer; the one to read does not.
		await userEvent.hover(open);
		await expect.poll(() => getComputedStyle(field(open)).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
		expect(getComputedStyle(open.element()).cursor).toBe("pointer");
		await userEvent.hover(read);
		await expect.poll(() => getComputedStyle(field(open)).backgroundColor).toBe("rgba(0, 0, 0, 0)");
		expect(getComputedStyle(field(read)).backgroundColor).toBe("rgba(0, 0, 0, 0)");
		expect(getComputedStyle(read.element()).cursor).not.toBe("pointer");
		expect(field(open).querySelector("svg")).not.toBeNull();
		// At its end: no × and no icon, whatever it was given. The control of the file's own stays, to read with.
		expect(field(read).querySelector("svg")).toBeNull();
		expect([...field(read).querySelectorAll("button")].map((button) => button.textContent)).toEqual(["설정"]);

		await userEvent.click(read);
		expect(opened).not.toHaveBeenCalled();
		await userEvent.click(open);
		expect(opened).toHaveBeenCalledTimes(1);
	});
});
