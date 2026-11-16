import { expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "../test/render";
import { AssistantSlot, Button, EditorHeader, IconButton, Inline, Text } from "./index";

it("the assistant's ✦ ends a head row 12px after the last control and 12px from the edge, whether the end group has padding of its own or not", async () => {
	render(
		<AssistantSlot button={<IconButton label="어시스턴트 열기">✦</IconButton>}>
			<div style={{ width: 800 }}>
				<EditorHeader>
					<Inline gap={12} minWidth={0} paddingX={12}>
						<Text>편집기로</Text>
					</Inline>
					<Inline gap={16} justify="end">
						<Button variant="ghost">버리기</Button>
						<Button>불러오기</Button>
					</Inline>
				</EditorHeader>
			</div>
		</AssistantSlot>,
	);
	const spark = page.getByRole("button", { name: "어시스턴트 열기" });
	await expect.element(spark).toBeVisible();
	const header = document.querySelector("[data-slot=editor-header]") as HTMLElement;
	const last = page.getByRole("button", { name: "불러오기" }).element().getBoundingClientRect();
	const mark = spark.element().getBoundingClientRect();
	expect(Math.round(mark.left - last.right)).toBe(12);
	expect(Math.round(header.getBoundingClientRect().right - mark.right)).toBe(12);
	// A head with only its start (a screen that failed to draw) has the ✦ at its end too.
});

it("a head row with only a start still ends with the ✦ at its far end", async () => {
	render(
		<AssistantSlot button={<IconButton label="어시스턴트 열기">✦</IconButton>}>
			<div style={{ width: 800 }}>
				<EditorHeader>
					<Text>편집기로</Text>
				</EditorHeader>
			</div>
		</AssistantSlot>,
	);
	const spark = page.getByRole("button", { name: "어시스턴트 열기" });
	await expect.element(spark).toBeVisible();
	const header = document.querySelector("[data-slot=editor-header]") as HTMLElement;
	expect(Math.round(header.getBoundingClientRect().right - spark.element().getBoundingClientRect().right)).toBe(12);
});
