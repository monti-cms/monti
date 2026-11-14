import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import { ModelMenu, ModelMenuButton } from "./index";

const GROUPS = [
	{
		key: "openrouter",
		label: "OpenRouter",
		count: 3,
		items: [
			{ value: "o:claude-opus-5-5", model: "anthropic/claude-opus-5-5" },
			{ value: "o:claude-sonnet-5-5", model: "anthropic/claude-sonnet-5-5" },
			{ value: "o:llama4", model: "meta/llama4" },
		],
	},
];

/** The group headers' words as they read: the key's name and its count. */
const headers = () =>
	[...document.querySelectorAll("[data-slot=dropdown-menu-label]")].map((label) => label.textContent?.trim());

describe("ModelMenu", () => {
	it("while a search filters the models, a group's count is the models it found there (ST-32)", async () => {
		render(
			<ModelMenu
				open
				value="o:llama4"
				onValueChange={() => {}}
				groups={GROUPS}
				searchLabel="모델 찾기"
				emptyText="맞는 모델이 없어요"
				trigger={<ModelMenuButton model="meta/llama4" label="모델 바꾸기" />}
			/>,
		);
		await expect.element(page.getByRole("menuitemradio", { name: "meta/llama4" })).toBeVisible();
		expect(headers()).toEqual(["OpenRouter3"]);
		await userEvent.fill(page.getByRole("textbox", { name: "모델 찾기" }), "claude");
		await expect.element(page.getByRole("menuitemradio", { name: "meta/llama4" })).not.toBeInTheDocument();
		expect(headers()).toEqual(["OpenRouter2"]);
	});
});
