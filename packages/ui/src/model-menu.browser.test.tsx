import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import { ModelMenu, ModelMenuButton, ThinkingMenu } from "./index";

const GROUPS = [
	{
		key: "openrouter",
		label: "OpenRouter",
		count: 3,
		items: [
			{ value: "o:claude-opus-5-5", model: "Anthropic: Claude Opus 5.5", id: "anthropic/claude-opus-5.5" },
			{ value: "o:claude-sonnet-5-5", model: "Anthropic: Claude Sonnet 5.5", id: "anthropic/claude-sonnet-5.5" },
			{ value: "o:llama4", model: "Meta: Llama 4", id: "meta-llama/llama-4:free", title: "meta-llama/llama-4:free" },
		],
	},
];

/** The group headers' words as they read: the key's name and its count. */
const headers = () =>
	[...document.querySelectorAll("[data-slot=dropdown-menu-label]")].map((label) => label.textContent?.trim());

const menu = () =>
	render(
		<ModelMenu
			open
			value="o:llama4"
			onValueChange={() => {}}
			groups={GROUPS}
			searchLabel="모델 찾기"
			emptyText="맞는 모델이 없어요"
			trigger={<ModelMenuButton model="Meta: Llama 4" label="모델 바꾸기" />}
		/>,
	);

describe("ModelMenu", () => {
	it("while a search filters the models, a group's count is the models it found there (ST-32)", async () => {
		menu();
		await expect.element(page.getByRole("menuitemradio", { name: "Meta: Llama 4" })).toBeVisible();
		expect(headers()).toEqual(["OpenRouter3"]);
		await userEvent.fill(page.getByRole("textbox", { name: "모델 찾기" }), "claude");
		await expect.element(page.getByRole("menuitemradio", { name: "Meta: Llama 4" })).not.toBeInTheDocument();
		expect(headers()).toEqual(["OpenRouter2"]);
	});

	it("a search finds a model by its id as well as by its name; the row's tooltip is its title", async () => {
		menu();
		await expect
			.element(page.getByRole("menuitemradio", { name: "Meta: Llama 4" }))
			.toHaveAttribute("title", "meta-llama/llama-4:free");
		await userEvent.fill(page.getByRole("textbox", { name: "모델 찾기" }), ":free");
		await expect.element(page.getByRole("menuitemradio", { name: "Meta: Llama 4" })).toBeVisible();
		expect(headers()).toEqual(["OpenRouter1"]);
	});

	it("the thinking button offers only the levels it is given, the current one ticked, and says the level in words", async () => {
		const picked: string[] = [];
		render(
			<ThinkingMenu
				value="medium"
				options={[
					{ value: "low", label: "낮음" },
					{ value: "medium", label: "보통" },
				]}
				onValueChange={(level) => picked.push(level)}
				label="생각"
				text="생각 보통"
			/>,
		);
		const button = page.getByRole("button", { name: "생각" });
		await expect.element(button).toHaveTextContent("생각 보통");
		await userEvent.click(button);
		await expect.element(page.getByRole("menuitemradio", { name: "보통" })).toHaveAttribute("aria-checked", "true");
		expect(
			page
				.getByRole("menuitemradio")
				.elements()
				.map((item) => item.textContent),
		).toEqual(["낮음", "보통"]);
		await userEvent.click(page.getByRole("menuitemradio", { name: "낮음" }));
		expect(picked).toEqual(["low"]);
	});
});
