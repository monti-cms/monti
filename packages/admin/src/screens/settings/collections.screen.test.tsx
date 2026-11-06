import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import * as collections from "./collections.stories";

const { NewItemCollection } = composeStories(collections);

describe("collection public pages", () => {
	it("keeps an item private until its public-page switch is enabled", async () => {
		await NewItemCollection.run();
		const publicPage = page.getByRole("switch", { name: "공개 주소 사용" });
		await expect.element(publicPage).not.toBeChecked();
		await expect.element(page.getByLabelText("공개 주소", { exact: true })).not.toBeInTheDocument();
		await publicPage.click();
		await expect.element(publicPage).toBeChecked();
		await expect.element(page.getByLabelText("공개 주소", { exact: true })).toBeVisible();
	});
});
