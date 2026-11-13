import { expect, operation, test, unique } from "./fixtures";
import { SUMMARY } from "./model-service";
import { MODEL } from "./servers";

type Post = { entry: { values: { summary?: string } } };

/** The key the flow gives the model service, which takes any. */
const SECRET = "sk-e2e-not-a-real-key-7q4z";

test.describe("the assistant (doc 10; flow 2)", () => {
	test("10-1 10-3 a key is added, the assistant is asked from the list with an entry picked, and what it proposes is reviewed, applied and undone", async ({
		admin,
	}) => {
		const title = unique("어시스턴트가 채울 글");
		const { output } = await operation<{ id: string }>(admin, "entries.create", {
			collection: "post",
			locale: "ko",
			title,
			slug: unique("assistant"),
		});
		const summary = async () =>
			((await operation<never>(admin, "entries.get", { id: output.id })) as unknown as Post).entry.values.summary ??
			null;

		// The key: an OpenAI-compatible service at an address. The window asks the service before it stores anything, and lists its model.
		const key = unique("E2E 모델");
		await admin.goto("/admin#/tools/keys");
		await admin.getByRole("button", { name: "키 추가" }).click();
		await admin.getByRole("button", { name: "OpenAI 호환 주소" }).click();
		const window = admin.getByRole("dialog");
		await window.getByLabel("주소").fill(MODEL);
		await window.getByLabel("이름").fill(key);
		await window.locator('input[type="password"]').fill(SECRET);
		await window.getByRole("button", { name: "추가", exact: true }).click();
		await expect(window).toBeHidden();
		const keys = admin.getByRole("main");
		await expect(keys.getByText(key).first()).toBeVisible();
		// It is stored, not only shown: there after a reload, by its last four letters. No answer carries the key itself (doc 14).
		await admin.reload();
		await expect(keys.getByText(key).first()).toBeVisible();
		await expect(keys.getByText(SECRET.slice(-4)).first()).toBeVisible();
		for (const name of ["keys.list", "models.list"]) {
			const answer = await admin.request.post(`/admin/api/operations/${name}`, { data: { input: {} } });
			expect(answer.status()).toBe(200);
			expect(await answer.text()).not.toContain(SECRET);
		}

		// Asked from the list, with the entry picked: it goes along as a chip.
		await admin.goto("/admin#/c/post");
		await admin.getByRole("checkbox", { name: `${title} 고르기` }).check({ force: true });
		await admin.getByRole("button", { name: "어시스턴트 열기" }).click();
		const panel = admin.getByRole("complementary", { name: "어시스턴트" });
		await expect(panel.getByText("고른 글 1편")).toBeVisible();
		await panel.getByRole("textbox", { name: "어시스턴트에게 묻기" }).fill("고른 글의 요약을 채워 줘");
		await admin.keyboard.press("Enter");
		await expect(panel.getByText("요약을 제안했습니다.")).toBeVisible();

		// A proposal, and nothing changed (10-3).
		await expect(panel.getByRole("button", { name: "1건 적용" })).toBeVisible();
		expect(await summary()).toBeNull();

		// Reviewed: the change is a row of its kind, with the entry's name and the words proposed.
		await panel.getByRole("button", { name: "검토" }).click();
		const review = admin.getByRole("main");
		await expect(review.getByRole("heading", { name: "제안 검토" })).toBeVisible();
		await expect(review.getByText(title).first()).toBeVisible();
		await expect(review.getByText(SUMMARY).first()).toBeVisible();

		// Applied: the entry has the summary.
		await review.getByRole("button", { name: "1건 적용" }).click();
		await expect(review.getByText("✓ 1건 적용")).toBeVisible();
		expect(await summary()).toBe(SUMMARY);

		// Undone: the entry is as it was, and the page says so.
		await review.getByRole("button", { name: "되돌리기" }).click();
		await expect(review.getByText(/^되돌림/).first()).toBeVisible();
		expect(await summary()).toBeNull();
	});
});
