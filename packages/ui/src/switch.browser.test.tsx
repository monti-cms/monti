import { expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import { Switch } from "./switch";

it("a read-only switch keeps its state on a press, is gray when on, not dimmed, and does not answer the pointer", async () => {
	const host = render(<Switch aria-label="장식 이미지" readOnly defaultChecked />);
	const probe = document.createElement("span");
	probe.className = "bg-(--monti-fg-faint)";
	host.append(probe);
	const gray = getComputedStyle(probe).backgroundColor;

	const control = page.getByRole("switch", { name: "장식 이미지" });
	await expect.element(control).toBeChecked();
	const style = () => getComputedStyle(control.element());
	expect(style().backgroundColor).toBe(gray);
	expect(style().opacity).toBe("1");
	expect(style().cursor).toBe("default");
	await userEvent.click(control);
	await expect.element(control).toBeChecked();
});
