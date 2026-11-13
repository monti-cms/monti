import type { KeyList, ModelList } from "@monti-cms/core";
import { toast } from "@monti-cms/ui";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { holdKey, keyTwice, pressTwice, releaseKey } from "../../../../../testing/input";
import type { StorySite } from "../../../.storybook/pglite-site";
import { scene } from "../../../test/scene";
import * as keys from "./keys.stories";
import { tokenAmount } from "./keys-screen";

type Loaded = {
	site: StorySite;
	net: keys.Network;
	letRead: () => void;
	failing: Set<string>;
	holdCall: (name: string) => () => void;
	calls: string[];
};
/** How many times the screen called an operation. */
const called = (loaded: Loaded, name: string) => loaded.calls.filter((call) => call === name).length;
/** Longer than a window's way out (150ms), and than a toast's way in. */
const faded = () => new Promise((done) => setTimeout(done, 500));
const open = (story: Parameters<typeof scene>[0]) => scene<Loaded>(story, keys.default);

// Storybook keeps toasts up, and a scene's toasts would stand over the next one's window: each scene starts with none.
afterEach(() => void toast.dismiss());

const button = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });
const field = (name: string | RegExp) => page.getByRole("textbox", { name });
const keyField = () => page.getByLabelText("키", { exact: true });
const dialog = () => page.getByRole("dialog");
const focused = () => document.activeElement;
const list = (site: StorySite) => site.monti.run("keys.list", {}, keys.admin) as Promise<KeyList>;
const models = (site: StorySite) => site.monti.run("models.list", {}, keys.admin) as Promise<ModelList>;

/** "+ 키 추가", then the service. */
async function addFor(service: string) {
	await userEvent.click(button("키 추가"));
	await userEvent.click(page.getByRole("option", { name: service }));
	await expect.element(dialog().getByRole("heading", { name: "키 추가" })).toBeVisible();
}
async function menu(name: string, item: string) {
	await userEvent.click(button(`${name} 더 보기`));
	await userEvent.click(page.getByRole("menuitem", { name: item }));
}

describe("adding a key (flow 10, 01–06)", () => {
	it("14-1 [flow 10·01–03, 06] the service is picked, the name is the service's and the caret is in the key; Enter adds it, and the row shows its name and last four", async () => {
		const story = open(keys.NoKeys);
		await story.run();
		await addFor("Anthropic");
		await expect.element(field(/이름/)).toHaveValue("Anthropic");
		expect(focused()).toBe(keyField().element());

		story.loaded().net.hold("held");
		await userEvent.type(keyField(), `${keys.sample.anthropic}{Enter}`);
		// While the service is asked, the pill says so.
		await expect.element(button("확인하는 중…")).toBeVisible();
		story.loaded().net.hold(null);
		await expect.element(page.getByText("키를 추가했습니다")).toBeVisible();
		await expect.element(dialog()).not.toBeInTheDocument();
		await expect.element(page.getByRole("cell", { name: /Anthropic/ }).getByText("··· a1b2")).toBeVisible();
		await expect.element(page.getByText("이번 달 사용 없음")).toBeVisible();
	});

	it("14-1 [flow 10·04] a key the service refuses: one line under the key, the window open with what was typed; corrected, it is added", async () => {
		const story = open(keys.NoKeys);
		await story.run();
		await addFor("Anthropic");
		await userEvent.type(keyField(), keys.sample.refused);
		await userEvent.click(button("추가"));
		await expect.element(page.getByText("맞지 않는 키입니다.")).toBeVisible();
		await expect.element(keyField()).toHaveValue(keys.sample.refused);
		await expect.element(keyField()).toHaveAttribute("aria-invalid", "true");
		expect((await list(story.loaded().site)).keys).toEqual([]);

		// The line is about the key that was sent: typed over, it goes at once, before the form is sent again.
		await userEvent.fill(keyField(), keys.sample.anthropic);
		await expect.element(page.getByText("맞지 않는 키입니다.")).not.toBeInTheDocument();
		await expect.element(keyField()).not.toHaveAttribute("aria-invalid");
		await userEvent.click(button("추가"));
		await expect.element(page.getByText("키를 추가했습니다")).toBeVisible();
		expect((await list(story.loaded().site)).keys).toMatchObject([{ name: "Anthropic", last4: "a1b2" }]);
	});

	it("14-1 a service that does not answer: the line says so, and pressing again asks it again", async () => {
		const story = open(keys.NoKeys);
		await story.run();
		await addFor("Anthropic");
		await userEvent.type(keyField(), keys.sample.unanswered);
		await userEvent.click(button("추가"));
		await expect.element(page.getByText("서비스가 답하지 않습니다.")).toBeVisible();
		const asked = story.loaded().net.requests.length;
		await userEvent.click(button("추가"));
		await expect.poll(() => story.loaded().net.requests.length).toBeGreaterThan(asked);
		await expect.element(page.getByText("서비스가 답하지 않습니다.")).toBeVisible();
	});

	it("14-1 [flow 10·05] a second key of a service is named with a number, and the window says which name was taken; a taken name typed by hand is refused under the name", async () => {
		const story = open(keys.NameTaken);
		await story.run();
		await expect.element(field(/이름/)).toHaveValue("Anthropic 2");
		await expect.element(page.getByText("이름이 Anthropic인 키가 이미 있습니다.")).toBeVisible();
		// Typed by hand, the note goes: the person named it.
		await userEvent.fill(field(/이름/), "Anthropic");
		await expect.element(page.getByText("이름이 Anthropic인 키가 이미 있습니다.")).not.toBeInTheDocument();
		await userEvent.type(keyField(), keys.sample.anthropicNew);
		await userEvent.click(button("추가"));
		await expect.element(page.getByText("이름이 Anthropic인 키가 이미 있습니다.")).toBeVisible();
		await expect.element(field(/이름/)).toHaveAttribute("aria-invalid", "true");
		expect(focused()).toBe(field(/이름/).element());
	});

	it("14-1 [flow 10·02b] a server of one's own: the window asks for its address, the name follows the address's host until it is typed, and the key may stay empty", async () => {
		const story = open(keys.NoKeys);
		await story.run();
		await addFor("OpenAI 호환 주소");
		expect(focused()).toBe(field(/주소/).element());
		await userEvent.type(field(/주소/), "http://localhost:11434/v1");
		await expect.element(field(/이름/)).toHaveValue("localhost:11434");
		await userEvent.click(button("추가"));
		await expect.element(page.getByText("키를 추가했습니다")).toBeVisible();
		expect((await list(story.loaded().site)).keys).toMatchObject([
			{ name: "localhost:11434", baseUrl: "http://localhost:11434/v1", last4: "", hasKey: false },
		]);
	});

	it("14-1 an empty key: the field says to fill it in and takes the caret, and the service is not asked", async () => {
		const story = open(keys.NoKeys);
		await story.run();
		await addFor("Anthropic");
		await userEvent.click(button("추가"));
		await expect.element(page.getByText("이 칸을 채워 주세요.")).toBeVisible();
		expect(focused()).toBe(keyField().element());
		expect(story.loaded().net.requests).toEqual([]);
	});

	it("14-1 while the service is asked the window cannot be left: Cancel is off, Esc and a press outside do nothing; the answer adds the key and closes it", async () => {
		const story = open(keys.NoKeys);
		await story.run();
		await addFor("Anthropic");
		story.loaded().net.hold("held");
		await userEvent.type(keyField(), keys.sample.anthropic);
		await userEvent.click(button("추가"));
		await expect.element(button("확인하는 중…")).toBeVisible();
		// Leaving would say "do not add it", and the add cannot be called back: until the answer the window stays.
		await expect.element(button("취소")).toBeDisabled();
		await userEvent.keyboard("{Escape}");
		const backdrop = document.querySelector("[data-slot=dialog-overlay]");
		if (!backdrop) throw new Error("no backdrop");
		backdrop.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
		backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		await new Promise((resolve) => setTimeout(resolve, 400));
		await expect.element(dialog()).toBeVisible();
		expect(document.querySelector("[data-slot=dialog-content]")?.hasAttribute("data-closed")).toBe(false);
		await expect.element(keyField()).toHaveValue(keys.sample.anthropic);
		expect((await list(story.loaded().site)).keys).toEqual([]);

		story.loaded().net.hold(null);
		await expect.element(page.getByText("키를 추가했습니다")).toBeVisible();
		await expect.element(dialog()).not.toBeInTheDocument();
		await expect.element(page.getByText("··· a1b2")).toBeVisible();
	});

	it("14-1 a refusal leaves the window open and lets it be left again: Cancel is back on, and Esc closes it with nothing added", async () => {
		const story = open(keys.NoKeys);
		await story.run();
		await addFor("Anthropic");
		story.loaded().net.hold("held");
		await userEvent.type(keyField(), keys.sample.refused);
		await userEvent.click(button("추가"));
		await expect.element(button("취소")).toBeDisabled();
		story.loaded().net.hold(null);
		await expect.element(page.getByText("맞지 않는 키입니다.")).toBeVisible();
		await expect.element(button("취소")).toBeEnabled();
		await userEvent.keyboard("{Escape}");
		await expect.element(dialog()).not.toBeInTheDocument();
		expect((await list(story.loaded().site)).keys).toEqual([]);
	});

	it("14-1 by the keyboard alone: to the pill, into the service list, through the window; Esc closes it and the focus is back on the pill", async () => {
		const story = open(keys.NoKeys);
		await story.run();
		button("키 추가").element().focus();
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("option", { name: "Anthropic" })).toBeVisible();
		// A window with no field takes the focus itself (no button shows a ring the moment it opens); Tab goes to the first service.
		await userEvent.keyboard("{Tab}");
		expect(focused()).toBe(page.getByRole("option", { name: "Anthropic" }).element());
		await userEvent.keyboard("{Enter}");
		await expect.element(keyField()).toBeVisible();
		await userEvent.keyboard(`${keys.sample.anthropic}{Enter}`);
		await expect.element(page.getByText("··· a1b2")).toBeVisible();

		button("키 추가").element().focus();
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("option", { name: "Anthropic" })).toBeVisible();
		await userEvent.keyboard("{Escape}");
		await expect.element(dialog()).not.toBeInTheDocument();
		expect(focused()).toBe(button("키 추가").element());
	});
});

describe("the key window as one window", () => {
	it("14-1 picking the service turns the same window into the key's fields: nothing closes and opens between the two", async () => {
		await open(keys.NoKeys).run();
		await userEvent.click(button("키 추가"));
		await expect.element(page.getByRole("option", { name: "Anthropic" })).toBeVisible();
		const first = dialog().element();
		await userEvent.click(page.getByRole("option", { name: "Anthropic" }));
		await expect.element(keyField()).toBeVisible();
		// The window that asked for the service is the one that asks for the key, over the one backdrop.
		expect(dialog().element()).toBe(first);
		expect(document.querySelectorAll("[data-slot=dialog-overlay]")).toHaveLength(1);
		expect(focused()).toBe(keyField().element());
	});

	it("14-1 closed, the window fades out as every window does, and a new one starts empty", async () => {
		await open(keys.NoKeys).run();
		await addFor("Anthropic");
		await userEvent.type(keyField(), "sk-ant-half-typed");
		await userEvent.click(button("취소"));
		// It is still in the page, leaving.
		const leaving = document.querySelector("[data-slot=dialog-content]");
		expect(leaving?.hasAttribute("data-closed")).toBe(true);
		await expect.element(dialog()).not.toBeInTheDocument();
		await addFor("Anthropic");
		await expect.element(keyField()).toHaveValue("");
	});

	it("14-1 changing the service in the window leaves the focus on the service, and the address field comes and goes", async () => {
		await open(keys.NoKeys).run();
		await addFor("Anthropic");
		const service = page.getByRole("combobox", { name: "서비스" });
		await userEvent.click(service);
		await userEvent.click(page.getByRole("option", { name: "OpenAI 호환 주소" }));
		await expect.element(field(/주소/)).toBeVisible();
		await expect.poll(() => focused()).toBe(service.element());
		// The name follows the service until it is typed.
		await expect.element(field(/이름/)).toHaveValue("OpenAI 호환 주소");
		await userEvent.click(service);
		await userEvent.click(page.getByRole("option", { name: "OpenAI", exact: true }));
		await expect.element(field(/주소/)).not.toBeInTheDocument();
		await expect.poll(() => focused()).toBe(service.element());
	});
});

describe("a key that could not be removed", () => {
	it("14-1 changed elsewhere since the list was read: the words every screen uses, and the list is read again", async () => {
		const story = open(keys.Keys);
		await story.run();
		const { site } = story.loaded();
		const [first] = (await list(site)).keys;
		if (!first) throw new Error("no key");
		await site.monti.run(
			"keys.update",
			{ id: first.id, name: "다른 창의 이름" },
			{ ...keys.admin, versions: { [`key:${first.id}`]: first.version } },
		);
		await menu("Anthropic 개인", "지우기");
		await userEvent.click(page.getByRole("alertdialog").getByRole("button", { name: "지우기" }));
		await expect.element(page.getByText("다른 곳에서 먼저 저장했습니다")).toBeVisible();
		await expect.element(page.getByText("다른 창의 이름", { exact: true })).toBeVisible();
		expect((await list(site)).keys).toHaveLength(3);
	});

	it("14-1 a server that fails says that it failed, not that the key was saved elsewhere", async () => {
		const story = open(keys.Keys);
		await story.run();
		story.loaded().failing.add("keys.remove");
		await menu("Anthropic 개인", "지우기");
		await userEvent.click(page.getByRole("alertdialog").getByRole("button", { name: "지우기" }));
		// A server that gave no reason: that it failed, and nothing after it (no "{message}").
		await expect.element(page.getByText("문제가 생겼습니다", { exact: true })).toBeVisible();
		await expect.element(page.getByText("다른 곳에서 먼저 저장했습니다")).not.toBeInTheDocument();
		expect((await list(story.loaded().site)).keys).toHaveLength(3);
	});
});

describe("one press does one thing", () => {
	it("14-1 '지우기' in the question pressed twice 40ms apart removes the key once: one call, and no word of a key saved elsewhere", async () => {
		const story = open(keys.Keys);
		await story.run();
		await menu("예전 Gemini 키", "지우기");
		const confirm = page.getByRole("alertdialog").getByRole("button", { name: "지우기" });
		await expect.element(confirm).toBeVisible();
		await pressTwice(confirm.element(), 40);
		await expect.element(page.getByText("키를 지웠습니다")).toBeVisible();
		await faded();
		expect(called(story.loaded(), "keys.remove")).toBe(1);
		await expect.element(page.getByText("다른 곳에서 먼저 저장했습니다")).not.toBeInTheDocument();
	});

	it("14-1 the form sent twice before the window is drawn again (two presses on a busy page) saves the new name once", async () => {
		const story = open(keys.Keys);
		await story.run();
		await menu("OpenAI 회사", "편집");
		await userEvent.fill(field(/이름/), "OpenAI 회사 2");
		// Nothing is drawn between the two: what the second one sees of the window is what the first one saw.
		const form = field(/이름/).element().closest("form") as HTMLFormElement;
		form.requestSubmit();
		form.requestSubmit();
		await expect.element(page.getByText("저장했습니다")).toBeVisible();
		await faded();
		expect(called(story.loaded(), "keys.update")).toBe(1);
		await expect.element(page.getByText("다른 곳에서 먼저 저장했습니다")).not.toBeInTheDocument();
	});

	it("14-1 Enter twice 40ms apart in '이름' saves the new name once", async () => {
		const story = open(keys.Keys);
		await story.run();
		await menu("OpenAI 회사", "편집");
		await userEvent.fill(field(/이름/), "OpenAI 회사 2");
		await keyTwice("Enter", 40);
		await expect.element(page.getByText("저장했습니다")).toBeVisible();
		await faded();
		expect(called(story.loaded(), "keys.update")).toBe(1);
		await expect.element(page.getByText("다른 곳에서 먼저 저장했습니다")).not.toBeInTheDocument();
	});

	it("14-1 Enter held down in the key adds it once, and the window does not open again under the held key", async () => {
		const story = open(keys.NoKeys);
		await story.run();
		await addFor("Anthropic");
		await userEvent.fill(keyField(), keys.sample.anthropic);
		try {
			// Held across the answer and the window's way out: the focus is back on "키 추가" by then.
			await holdKey("Enter", { repeats: 30, every: 40 });
		} finally {
			await releaseKey("Enter");
		}
		await expect.element(page.getByText("키를 추가했습니다")).toBeVisible();
		await faded();
		expect(called(story.loaded(), "keys.add")).toBe(1);
		await expect.element(dialog()).not.toBeInTheDocument();
		await expect.element(page.getByText(/이미 있습니다/)).not.toBeInTheDocument();
	});
});

describe("where the focus is afterwards", () => {
	/** Opens a row's ⋯ and its question with the keyboard, and stands on the question's "지우기". */
	async function askByKeyboard(name: string) {
		button(`${name} 더 보기`).element().focus();
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("menuitem", { name: "지우기" })).toBeVisible();
		await userEvent.keyboard("{End}{Enter}");
		const confirm = page.getByRole("alertdialog").getByRole("button", { name: "지우기" });
		await expect.element(confirm).toBeVisible();
		await userEvent.keyboard("{Tab}{Tab}");
		expect(focused()).toBe(confirm.element());
	}
	const gone = (name: string) => expect.element(page.getByText(name, { exact: true })).not.toBeInTheDocument();

	it("14-1 a key removed with the keyboard: the focus goes to the ⋯ of the row after it, with none after it to the row before, with no row left to '키 추가'", async () => {
		const story = open(keys.Keys);
		await story.run();
		const names = (await list(story.loaded().site)).keys.map((key) => key.name);
		const [first, second, third] = names;
		if (!first || !second || !third) throw new Error("three keys");

		await askByKeyboard(first);
		await userEvent.keyboard("{Enter}");
		await gone(first);
		await expect.poll(focused).toBe(button(`${second} 더 보기`).element());

		await askByKeyboard(third);
		await userEvent.keyboard("{Enter}");
		await gone(third);
		await expect.poll(focused).toBe(button(`${second} 더 보기`).element());

		await askByKeyboard(second);
		await userEvent.keyboard("{Enter}");
		await gone(second);
		await expect.poll(focused).toBe(button("키 추가").element());
	});

	it("14-1 on a site that cannot store keys the last key removed with the keyboard leaves the focus on the page's tab", async () => {
		const story = open(keys.NoSecretWithKeys);
		await story.run();
		// The story stands with a row's menu open.
		await userEvent.keyboard("{Escape}");
		await expect.element(page.getByRole("menuitem", { name: "지우기" })).not.toBeInTheDocument();
		const names = (await list(story.loaded().site)).keys.map((key) => key.name);
		for (const name of names) {
			await askByKeyboard(name);
			await userEvent.keyboard("{Enter}");
			await gone(name);
		}
		await expect.poll(() => focused()?.textContent).toBe("템플릿");
	});

	it("14-1 a key removed with the pointer moves no focus: it is not put on another row", async () => {
		const story = open(keys.Keys);
		await story.run();
		await menu("Anthropic 개인", "지우기");
		await userEvent.click(page.getByRole("alertdialog").getByRole("button", { name: "지우기" }));
		await gone("Anthropic 개인");
		await faded();
		expect(focused()).toBe(document.body);
	});

	it("14-1 a question left with '취소' or Esc gives the focus back to the row's ⋯", async () => {
		await open(keys.Keys).run();
		await askByKeyboard("OpenAI 회사");
		await userEvent.keyboard("{Escape}");
		await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument();
		await expect.poll(focused).toBe(button("OpenAI 회사 더 보기").element());
	});

	it("14-1 a server that fails while the service is asked: a toast, and the caret is in the key as after a refusal", async () => {
		const story = open(keys.NoKeys);
		await story.run();
		await addFor("Anthropic");
		await userEvent.fill(keyField(), keys.sample.anthropic);
		story.loaded().failing.add("keys.add");
		await userEvent.click(button("추가"));
		await expect.element(page.getByText("문제가 생겼습니다", { exact: true })).toBeVisible();
		await expect.element(dialog()).toBeVisible();
		await expect.poll(focused).toBe(keyField().element());
	});
});

describe("changing and removing a key (flow 10, 07–11)", () => {
	it("14-1 a key changed elsewhere since the list was read: saving says so in the words every screen uses, and the list is read again", async () => {
		const story = open(keys.Keys);
		await story.run();
		await menu("Anthropic 개인", "편집");
		const { site } = story.loaded();
		const [first] = (await list(site)).keys;
		if (!first) throw new Error("no key");
		await site.monti.run(
			"keys.update",
			{ id: first.id, name: "다른 창의 이름" },
			{ ...keys.admin, versions: { [`key:${first.id}`]: first.version } },
		);
		await userEvent.fill(field(/이름/), "이 창의 이름");
		await userEvent.click(button("저장"));
		await expect.element(page.getByText("다른 곳에서 먼저 저장했습니다")).toBeVisible();
		await expect.element(dialog()).not.toBeInTheDocument();
		await expect.element(page.getByText("다른 창의 이름", { exact: true })).toBeVisible();
	});

	it("14-1 [flow 10·07, 10] the window shows the service as words; a new name alone is saved without asking the service", async () => {
		const story = open(keys.Keys);
		await story.run();
		await menu("Anthropic 개인", "편집");
		await expect.element(dialog().getByText("Anthropic", { exact: true })).toBeVisible();
		await expect.element(dialog().getByRole("combobox")).not.toBeInTheDocument();
		expect(focused()).toBe(field(/이름/).element());
		await userEvent.fill(field(/이름/), "Anthropic 회사");
		await userEvent.click(button("저장"));
		await expect.element(page.getByText("저장했습니다")).toBeVisible();
		expect(story.loaded().net.requests).toEqual([]);
		expect((await list(story.loaded().site)).keys[0]).toMatchObject({ name: "Anthropic 회사", last4: "a1b2" });
	});

	it("14-1 [flow 10·08–10] '바꾸기' opens an empty key field with the caret in it; '그대로' puts the stored key back and nothing below moves; a new key is checked and the row's ending changes", async () => {
		const story = open(keys.Keys);
		await story.run();
		await menu("Anthropic 개인", "편집");
		await expect.element(button("바꾸기")).toBeVisible();
		// The window has come to rest (it opens with a short motion).
		await Promise.all(
			dialog()
				.element()
				.getAnimations({ subtree: true })
				.map((animation) => animation.finished),
		);
		const save = () => button("저장").element().getBoundingClientRect().top;
		const before = save();
		await userEvent.click(button("바꾸기"));
		expect(focused()).toBe(keyField().element());
		await expect.element(keyField()).toHaveValue("");
		expect(save()).toBe(before);
		await userEvent.click(button("그대로"));
		await expect.element(dialog().getByText("··· a1b2")).toBeVisible();
		expect(save()).toBe(before);

		await userEvent.click(button("바꾸기"));
		await userEvent.type(keyField(), keys.sample.anthropicNew);
		await userEvent.click(button("저장"));
		await expect.element(page.getByText("저장했습니다")).toBeVisible();
		await expect.element(page.getByText("··· 7c0e")).toBeVisible();
		expect(story.loaded().net.requests.length).toBeGreaterThan(0);
	});

	it("14-1 [flow 10·11] removing a key in use lists what stops; removed, its row is gone and the quick tasks use the next key's model; '취소' leaves it", async () => {
		const story = open(keys.Keys);
		await story.run();
		await menu("Anthropic 개인", "지우기");
		const asking = page.getByRole("alertdialog");
		// The question has no name in it; which key stands first in the window, before what stops.
		await expect.element(asking.getByRole("heading", { name: "키를 지울까요?" })).toBeVisible();
		await expect.element(asking.getByText("Anthropic 개인")).toBeVisible();
		await expect.element(asking.getByText("되돌릴 수 없습니다. 이 키를 쓰는 곳이 멈춥니다.")).toBeVisible();
		await expect.element(asking.getByText("claude-sonnet-5-5")).toBeVisible();
		await expect.element(asking.getByText("claude-haiku-5-5")).toBeVisible();
		await userEvent.click(asking.getByRole("button", { name: "취소" }));
		expect((await list(story.loaded().site)).keys).toHaveLength(3);

		await menu("Anthropic 개인", "지우기");
		await userEvent.click(page.getByRole("alertdialog").getByRole("button", { name: "지우기" }));
		await expect.element(page.getByText("키를 지웠습니다")).toBeVisible();
		await expect.element(page.getByText("Anthropic 개인")).not.toBeInTheDocument();
		// The quick tasks go on with a model of a key that is left.
		const next = (await models(story.loaded().site)).quick;
		expect(next?.model).toBeDefined();
		await expect.element(button(/빠른 작업/)).toHaveTextContent(next?.model ?? "");
	});

	it("14-1 [flow 10·11b] a key nothing uses is asked about without a list", async () => {
		await open(keys.RemoveUnusedKey).run();
		const asking = page.getByRole("alertdialog");
		await expect.element(asking.getByRole("heading", { name: "키를 지울까요?" })).toBeVisible();
		await expect.element(asking.getByText("예전 Gemini 키")).toBeVisible();
		await expect.element(asking.getByText("되돌릴 수 없습니다.", { exact: true })).toBeVisible();
		await expect.element(asking.getByText("어시스턴트")).not.toBeInTheDocument();
	});

	it("14-1 a row's ⋯ by the keyboard: Enter opens it, the arrows move through '편집' and '지우기', Esc closes it and the focus is back on the ⋯", async () => {
		await open(keys.Keys).run();
		const more = button("Anthropic 개인 더 보기");
		more.element().focus();
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("menuitem", { name: "편집" })).toBeVisible();
		// Opened with the keyboard, the first row has the focus; one arrow down is the last.
		expect(focused()).toBe(page.getByRole("menuitem", { name: "편집" }).element());
		await userEvent.keyboard("{ArrowDown}");
		expect(focused()).toBe(page.getByRole("menuitem", { name: "지우기" }).element());
		await userEvent.keyboard("{Escape}");
		await expect.element(page.getByRole("menuitem", { name: "편집" })).not.toBeInTheDocument();
		expect(focused()).toBe(more.element());
	});
});

describe("the quick tasks' model (flow 10, 13)", () => {
	it("14-1 [flow 10·13, 13b] the menu has the models under their keys with the current one ticked; typing narrows it; a pick shows in the row with its key", async () => {
		const story = open(keys.Keys);
		await story.run();
		const now = (await models(story.loaded().site)).quick;
		await userEvent.click(button(/빠른 작업/));
		await expect
			.element(page.getByRole("menuitemradio", { name: new RegExp(now?.model ?? "") }))
			.toHaveAttribute("aria-checked", "true");
		await expect.element(page.getByText("OpenAI 회사", { exact: true })).toBeVisible();
		await userEvent.fill(page.getByRole("textbox", { name: "모델 찾기" }), "mini");
		await expect.element(page.getByRole("menuitemradio", { name: /claude-opus-5-5/ })).not.toBeInTheDocument();
		await userEvent.click(page.getByRole("menuitemradio", { name: /gpt-5\.4-mini/ }));
		await expect.element(page.getByText("빠른 작업 모델을 바꿨습니다")).toBeVisible();
		await expect.element(button(/빠른 작업/)).toHaveTextContent("gpt-5.4-mini");
		await expect.element(button(/빠른 작업/)).toHaveTextContent("OpenAI 회사");
		expect((await models(story.loaded().site)).quick).toMatchObject({ model: "gpt-5.4-mini", chosen: true });
	});

	it("14-1 with no key the field says so, and pressing it opens the way to add one", async () => {
		await open(keys.NoKeys).run();
		await expect.element(button(/빠른 작업/)).toHaveTextContent("키 없음");
		await userEvent.click(button(/빠른 작업/));
		await expect.element(page.getByRole("option", { name: "Anthropic" })).toBeVisible();
	});
});

describe("the server's secret (flow 10, 14–15)", () => {
	it("14-1 [flow 10·14, 14b] keys the server can no longer read: the banner counts them and each row says so; entered again, a key is back and the count goes down", async () => {
		const story = open(keys.Unreadable);
		await story.run();
		await expect.element(page.getByText("키 3개를 읽을 수 없습니다")).toBeVisible();
		await expect.element(page.getByText("MONTI_SECRET 변경")).toBeVisible();
		expect(page.getByText("읽을 수 없음").elements()).toHaveLength(3);
		// The banner stands over the page's title.
		const banner = page.getByText("키 3개를 읽을 수 없습니다").element().getBoundingClientRect();
		const title = page.getByRole("heading", { name: "도구" }).element().getBoundingClientRect();
		expect(banner.bottom).toBeLessThanOrEqual(title.top);

		await menu("Anthropic 개인", "편집");
		await expect.element(page.getByText("키를 다시 넣어 주세요.")).toBeVisible();
		expect(focused()).toBe(keyField().element());
		await userEvent.type(keyField(), keys.sample.anthropic);
		await userEvent.click(button("저장"));
		await expect.element(page.getByText("저장했습니다")).toBeVisible();
		await expect.element(page.getByText("키 2개를 읽을 수 없습니다")).toBeVisible();
		expect(page.getByText("읽을 수 없음").elements()).toHaveLength(2);
	});

	it("14-1 [flow 10·15] without a secret: one banner, no pill to add with and no model row; a key from before can only be removed", async () => {
		const story = open(keys.NoSecretWithKeys);
		await story.run();
		await expect.element(page.getByText("키를 저장할 수 없습니다")).toBeVisible();
		await expect.element(page.getByText("MONTI_SECRET 없음")).toBeVisible();
		await expect.element(button("키 추가")).not.toBeInTheDocument();
		await expect.element(page.getByText("빠른 작업")).not.toBeInTheDocument();
		await expect.element(page.getByRole("menuitem", { name: "편집" })).not.toBeInTheDocument();
		await userEvent.click(page.getByRole("menuitem", { name: "지우기" }));
		await userEvent.click(page.getByRole("alertdialog").getByRole("button", { name: "지우기" }));
		await expect.element(page.getByText("키를 지웠습니다")).toBeVisible();
		expect((await list(story.loaded().site)).keys).toHaveLength(2);
	});
});

describe("before the list is read", () => {
	it("14-1 a site that cannot store keys never shows the way to add one, not even while its list is being read", async () => {
		const story = open({ loaders: keys.site({ keys: "none", secret: null, reading: true }) });
		await story.run();
		await expect.element(page.getByRole("link", { name: "API 키" })).toBeVisible();
		// The read has not come: there is the title and the tabs, and nothing that depends on the list.
		await expect.element(button("키 추가")).not.toBeInTheDocument();
		await expect.element(page.getByText("키를 저장할 수 없습니다")).not.toBeInTheDocument();
		story.loaded().letRead();
		await expect.element(page.getByText("키를 저장할 수 없습니다")).toBeVisible();
		await expect.element(button("키 추가")).not.toBeInTheDocument();
	});

	it("14-1 a site that can store keys shows the pill once its list is read", async () => {
		const story = open({ loaders: keys.site({ reading: true }) });
		await story.run();
		await expect.element(page.getByRole("link", { name: "API 키" })).toBeVisible();
		await expect.element(button("키 추가")).not.toBeInTheDocument();
		story.loaded().letRead();
		await expect.element(button("키 추가")).toBeVisible();
	});
});

describe("a long name", () => {
	it("14-1 the longest name a key may have stays on one line; where the row is too short it is cut, the key's last four keep their room, and the row is as tall as the others", async () => {
		await open(keys.LongName).run();
		const row = (name: string | RegExp) => page.getByRole("row", { name }).element().getBoundingClientRect();
		const long = page.getByRole("cell", { name: /^블로그초안/ }).first();
		const name = long.getByText(keys.longName).element();
		const tail = () => long.getByText("··· a1b2").element().getBoundingClientRect();
		const more = () => button(`${keys.longName} 더 보기`).element().getBoundingClientRect();
		// As tall as the others to half a pixel: a name with no Latin letter sits on another baseline than one with some.
		expect(tail().right).toBeLessThanOrEqual(more().left);
		expect(Math.abs(row(/블로그초안/).height - row(/OpenAI 회사/).height)).toBeLessThanOrEqual(0.5);
		// A smaller window, where the row is shorter than the name.
		const { innerWidth, innerHeight } = window;
		await page.viewport(1024, 768);
		try {
			expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
			expect(tail().width).toBeGreaterThan(0);
			expect(tail().right).toBeLessThanOrEqual(more().left);
			expect(Math.abs(row(/블로그초안/).height - row(/OpenAI 회사/).height)).toBeLessThanOrEqual(0.5);
		} finally {
			await page.viewport(innerWidth, innerHeight);
		}
		// The model field under the list names the key too: the model keeps its room, the name gives way, and nothing leaves the field.
		const quick = button(/빠른 작업/).element();
		expect(quick.scrollWidth).toBeLessThanOrEqual(quick.clientWidth);
		const model = page.getByText("claude-haiku-5-5").element();
		const words = document.createRange();
		words.selectNodeContents(model);
		expect(model.getBoundingClientRect().width).toBeGreaterThanOrEqual(words.getBoundingClientRect().width);
		// In the window that asks, the whole name is read, on as many lines as it takes, inside the window.
		await menu(keys.longName, "지우기");
		const asking = page.getByRole("alertdialog");
		await expect.element(asking.getByText(keys.longName)).toBeVisible();
		const box = asking.element();
		expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
	});
});

describe("the key itself", () => {
	it("14-4 once added, the key is nowhere in the page: not in its words, not in a field, not in what the browser keeps", async () => {
		const story = open(keys.NoKeys);
		await story.run();
		await addFor("Anthropic");
		// It shows as dots while it is typed, and the eye shows it only then.
		await userEvent.type(keyField(), keys.sample.anthropic);
		expect(keyField().element().getAttribute("type")).toBe("password");
		await userEvent.click(button("추가"));
		await expect.element(page.getByText("키를 추가했습니다")).toBeVisible();
		await menu("Anthropic", "편집");
		await expect.element(dialog().getByText("··· a1b2")).toBeVisible();

		const fields = [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")];
		const kept = [document.documentElement.outerHTML, ...fields.map((each) => each.value)];
		for (const store of [localStorage, sessionStorage])
			for (let index = 0; index < store.length; index += 1) kept.push(store.getItem(store.key(index) ?? "") ?? "");
		for (const text of kept) expect(text).not.toContain(keys.sample.anthropic);
		expect(await button("키 보기").elements()).toHaveLength(0);
	});
});

describe("the tools' tabs", () => {
	it("14-1 '템플릿' and 'API 키' are two pages of the tools, each with its own address", async () => {
		await open(keys.Keys).run();
		expect(window.location.hash).toBe("#/tools/keys");
		await expect.element(page.getByRole("link", { name: "API 키" })).toHaveAttribute("aria-current", "page");
		await userEvent.click(page.getByRole("link", { name: "템플릿" }));
		await expect.element(button("템플릿 추가")).toBeVisible();
		expect(window.location.hash).toBe("#/tools");
		await userEvent.click(page.getByRole("link", { name: "API 키" }));
		await expect.element(page.getByText("이번 달 1.24M 토큰")).toBeVisible();
		expect(window.location.hash).toBe("#/tools/keys");
	});

	it("a tab opened with Enter keeps the keyboard's focus: it is on the same tab of the page that opened, not on the page; a pointer's press moves none", async () => {
		await open(keys.Keys).run();
		const tab = (name: string) => page.getByRole("link", { name });
		await expect.element(tab("템플릿")).toBeVisible();
		for (let presses = 0; presses < 60 && focused() !== tab("템플릿").element(); presses++) await userEvent.tab();
		expect(focused()).toBe(tab("템플릿").element());
		await userEvent.keyboard("{Enter}");
		await expect.element(button("템플릿 추가")).toBeVisible();
		await expect.element(tab("템플릿")).toHaveAttribute("aria-current", "page");
		await expect.element(tab("템플릿")).toHaveFocus();
		await userEvent.click(tab("API 키"));
		await expect.element(page.getByText("이번 달 1.24M 토큰")).toBeVisible();
		expect(focused()).not.toBe(tab("API 키").element());
	});

	it("14-1 how much a key used reads short: as it is under a thousand, then in thousands, then in millions", () => {
		expect([812, 1000, 312_400, 1_240_000].map(tokenAmount)).toEqual(["812", "1K", "312K", "1.24M"]);
	});
});
