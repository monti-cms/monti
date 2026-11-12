import type { Doc } from "@monti-cms/core";
import { toast } from "@monti-cms/ui";
import { composeStories } from "@storybook/react-vite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { caretAfter, dragPath, dropDrag, middleOf, pickWords } from "../../../../../testing/input";
import type { StorySite } from "../../../.storybook/pglite-site";
import { scene } from "../../../test/scene";
import * as entry from "./entry.stories";

type Loaded = { site: StorySite; id: string };

const { BrowserCopy } = composeStories(entry);

/** The editor on an entry of this kind, with its site at hand. */
const on = (...made: Parameters<typeof entry.site>) => scene<Loaded>({ loaders: entry.site(...made) }, entry.default);
/** A story's state, with its site at hand. */
const from = (story: (typeof entry)["Draft"]) => scene<Loaded>(story, entry.default);

const title = () => page.getByRole("textbox", { name: "제목" });
const body = () => page.getByRole("textbox", { name: "본문" });
const button = (name: string | RegExp) => page.getByRole("button", { name });
const within = (selector: string) => [...body().element().querySelectorAll<HTMLElement>(selector)];

/** Waits for the editor: its title and its body. */
async function opened() {
	await expect.element(title()).toBeVisible();
	await expect.element(body()).toBeVisible();
}

/** The save cell says this (a live region repeats its words for screen readers, so the cell is read by its slot). */
const saveCell = (text: string) =>
	expect
		.poll(() => [...document.querySelectorAll("[data-slot=status-bar-cell]")].map((cell) => cell.textContent))
		.toContain(text);

/** Puts the caret at the end of the title: a press past its last letter. */
async function titleEnd() {
	const box = title().element().getBoundingClientRect();
	await userEvent.click(title(), { position: { x: box.width - 4, y: box.height / 2 } });
}

const save = () => userEvent.keyboard("{Meta>}s{/Meta}");
const kept = async ({ site, id }: Loaded) =>
	((await site.monti.run("entries.get", { id }, entry.admin)) as { entry: { doc: Doc } }).entry.doc.blocks;

/** The table's column widths as the editor draws them. */
const shares = () => within("col").map((col) => col.style.width);
/** The table is no wider than the body. */
const fitsBody = () => {
	const table = within("table")[0];
	return !!table && table.getBoundingClientRect().width <= body().element().getBoundingClientRect().width + 1;
};
/** The table's cells as rows of text. */
const cells = () => within("tr").map((row) => [...row.querySelectorAll("td, th")].map((cell) => cell.textContent));
const cell = (words: string) => body().getByRole("cell", { name: words, exact: true });
/** The footnotes' numbers and texts, in the order the editor shows them. */
const notes = () => ({
	refs: within("[data-footnote-ref]").map((ref) => ref.getAttribute("data-n")),
	notes: within("[data-footnote]").map((note) => `${note.getAttribute("data-n")}. ${note.textContent}`),
});

describe("the entry editor: saving and coming back", () => {
	it("the save cell pressed with the keyboard goes away saved, and the focus goes to the text, not to the page; a pointer's press moves none", async () => {
		await on("draft").run();
		await opened();
		const unsaved = page.getByRole("button", { name: "저장 전 변경사항" });
		await titleEnd();
		await userEvent.keyboard(" 다시");
		await expect.element(unsaved).toBeVisible();
		// The keyboard is what was last used, so a focus set here is the keyboard's (as after the Tab keys that reach the status bar).
		(unsaved.element() as HTMLElement).focus();
		expect(unsaved.element().matches(":focus-visible")).toBe(true);
		await userEvent.keyboard("{Enter}");
		await saveCell("저장됨");
		await expect.element(unsaved).not.toBeInTheDocument();
		await expect.element(body()).toHaveFocus();

		await titleEnd();
		await userEvent.keyboard(" 한 번 더");
		await userEvent.click(unsaved);
		await saveCell("저장됨");
		await expect.element(unsaved).not.toBeInTheDocument();
		await expect.element(body()).not.toHaveFocus();
	});

	it("[flow 1·09] ⌘S saves what was typed: the save cell turns to saved", async () => {
		await on("draft").run();
		await opened();
		await titleEnd();
		await userEvent.keyboard(" 다시 쓰기");
		await save();
		await saveCell("저장됨");
		await expect.element(title()).toHaveValue("첫 번째 글 다시 쓰기");
	});

	it("16-2 'Preview' opens the site's preview address in a new tab, with the entry's ticket and the page to go on to", async () => {
		const story = on("draft");
		await story.run();
		await opened();
		const opens: unknown[][] = [];
		const open = window.open;
		window.open = (...args: unknown[]) => {
			opens.push(args);
			return null;
		};
		try {
			await userEvent.click(button("미리보기"));
			await expect.poll(() => opens.length).toBe(1);
		} finally {
			window.open = open;
		}
		const [address, target] = opens[0] as [string, string];
		const url = new URL(address, "http://site.test");
		// The admin API's own address: it turns the preview on, then goes to the entry's public page.
		expect(url.pathname).toBe("/admin/api/preview");
		expect(url.searchParams.get("path")).toMatch(/^\/posts\/.+/);
		expect(url.searchParams.get("token")?.length ?? 0).toBeGreaterThan(20);
		expect(target).toBe("_blank");
	});

	it("a to-do's row takes the cursor to its place: the empty title", async () => {
		await on("untitled").run();
		await opened();
		await userEvent.click(button("할 일 2"));
		await userEvent.click(button(/제목 쓰기/));
		await expect.element(title()).toHaveFocus();
	});

	/** Tab until the button has the keyboard's focus (a banner's actions are the first stops of the page). */
	const tabTo = async (name: string) => {
		for (let pressed = 0; pressed < 6 && document.activeElement !== button(name).element(); pressed++)
			await userEvent.keyboard("{Tab}");
		await expect.element(button(name)).toHaveFocus();
		expect(button(name).element().matches(":focus-visible")).toBe(true);
	};

	it("a banner's own action that takes the banner away, pressed with the keyboard, hands the focus to the text: discard, and load after its wait", async () => {
		await BrowserCopy.run();
		await opened();
		await tabTo("버리기");
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByText("이 브라우저에 저장하지 않은 편집이 있습니다")).not.toBeInTheDocument();
		await expect.element(body()).toHaveFocus();

		// "Load" works for a while first: it keeps the focus while it does, and hands it on when the banner goes.
		await BrowserCopy.run();
		await opened();
		await tabTo("불러오기");
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByText("이 브라우저에 저장하지 않은 편집이 있습니다")).not.toBeInTheDocument();
		await expect.element(body()).toHaveFocus();
	});

	it("a key held down on a banner's action writes nothing into the text: the focus is handed on when the key comes up", async () => {
		await BrowserCopy.run();
		await opened();
		const blocks = within("p, h1, h2, h3").length;
		await tabTo("버리기");
		// Held: the key goes down and stays down (the test's keyboard lets a key go before it presses it again, so the repeats are sent as
		// events: they go to whatever holds the focus, as a held key's do, and the body's editor acts on them).
		await userEvent.keyboard("{Enter>}");
		await expect.element(page.getByText("이 브라우저에 저장하지 않은 편집이 있습니다")).not.toBeInTheDocument();
		const repeat = () =>
			(document.activeElement ?? document.body).dispatchEvent(
				new KeyboardEvent("keydown", { key: "Enter", code: "Enter", repeat: true, bubbles: true, cancelable: true }),
			);
		// Long enough for a focus handed on too early to have arrived (it is given two frames after the banner goes).
		for (let frame = 0; frame < 6; frame++) await new Promise((drawn) => requestAnimationFrame(drawn));
		repeat();
		repeat();
		expect(document.activeElement).toBe(document.body);
		expect(within("p, h1, h2, h3")).toHaveLength(blocks);
		await userEvent.keyboard("{/Enter}");
		await expect.element(body()).toHaveFocus();
		expect(within("p, h1, h2, h3")).toHaveLength(blocks);
		await expect.element(button("저장 전 변경사항")).not.toBeInTheDocument();
	});

	it("\"compare\" pressed with the keyboard gives the editor's place to the comparison, and the focus to the comparison's first control", async () => {
		await BrowserCopy.run();
		await opened();
		await tabTo("비교하기");
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByText("임시 저장본과 비교")).toBeVisible();
		await expect.element(button("편집기로")).toHaveFocus();
	});

	it("the comparison draws nothing until its read is in: however long that takes, the focus is on its first control once it is drawn", async () => {
		const story = from(entry.BrowserCopy);
		await story.run();
		await opened();
		// A slow server: the comparison's own read of the entry answers half a second late, long after the editor is gone.
		const { site } = story.loaded();
		const run = site.monti.run.bind(site.monti);
		let slowed = 0;
		site.monti.run = (async (name: string, ...rest: unknown[]) => {
			if (name === "entries.get") {
				slowed += 1;
				await new Promise((answered) => setTimeout(answered, 500));
			}
			return (run as (...all: unknown[]) => unknown)(name, ...rest);
		}) as typeof site.monti.run;
		await tabTo("비교하기");
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByText("임시 저장본과 비교")).toBeVisible();
		expect(slowed).toBeGreaterThan(0);
		await expect.element(button("편집기로")).toHaveFocus();
	});

	it("the comparison gets the focus while the body it replaced is not yet taken down", async () => {
		await BrowserCopy.run();
		await opened();
		await tabTo("비교하기");
		// The editor library takes a replaced body down a task later (a 1ms timer). On a busy page two frames pass before that task runs:
		// hold it back, so the hand-off meets a body that is out of the page and not yet destroyed.
		const timer = window.setTimeout;
		const held = vi
			.spyOn(window, "setTimeout")
			.mockImplementation(((run: TimerHandler, ms?: number, ...rest: unknown[]) =>
				timer(run, ms === 1 ? 400 : ms, ...rest)) as typeof window.setTimeout);
		try {
			await userEvent.keyboard("{Enter}");
			await expect.element(button("편집기로")).toHaveFocus();
		} finally {
			held.mockRestore();
		}
	});

	it("a save the keyboard asked of the save cell and the server refused leaves the cell, and the focus on it", async () => {
		const story = on("draft");
		await story.run();
		await opened();
		await titleEnd();
		await userEvent.keyboard(" 다시 쓰기");
		const { site, id } = story.loaded();
		await site.monti.run("entries.save", { id, version: 1, title: "첫 번째 글 (다른 탭)" }, entry.admin);
		const cell = button("저장 전 변경사항");
		(cell.element() as HTMLElement).focus();
		expect(cell.element().matches(":focus-visible")).toBe(true);
		await userEvent.keyboard("{Enter}");
		// Saved elsewhere first: the cell is still a button, with other words, and nothing took its focus.
		await expect.element(button("편집 충돌")).toHaveFocus();
		await expect.element(body()).not.toHaveFocus();
	});

	it("the same action pressed with the pointer moves no focus", async () => {
		await BrowserCopy.run();
		await opened();
		await userEvent.click(button("버리기"));
		await expect.element(page.getByText("이 브라우저에 저장하지 않은 편집이 있습니다")).not.toBeInTheDocument();
		await expect.element(body()).not.toHaveFocus();
	});

	it("[flow 1·19] input this browser kept is compared with the server's copy", async () => {
		await BrowserCopy.run();
		await userEvent.click(button("비교하기"));
		await expect.element(page.getByText("임시 저장본과 비교")).toBeVisible();
		await expect.element(page.getByText(/다른 곳 \d/)).toBeVisible();
	});

	it("15 (T39) signing in again brings back the same entry with what was typed, ready to save", async () => {
		await from(entry.SignedOut).run();
		await userEvent.click(button("다시 로그인"));
		await userEvent.fill(page.getByLabelText("이메일"), "me@example.dev");
		await userEvent.fill(page.getByRole("textbox", { name: "비밀번호" }), "story password");
		await userEvent.click(button("로그인"));
		await expect.element(title()).toHaveValue("첫 번째 글 다시 쓰기");
		await expect.element(page.getByText("로그인이 풀렸습니다")).not.toBeInTheDocument();
		await expect.element(page.getByText("이 브라우저에 저장하지 않은 편집이 있습니다")).not.toBeInTheDocument();
		await userEvent.click(button("저장 전 변경사항"));
		await saveCell("저장됨");
	});

	it("an address typed in the link card is one row that links out", async () => {
		await on("draft").run();
		await opened();
		await pickWords(body().element(), "지금 상태만");
		await userEvent.click(button("링크"));
		await userEvent.fill(page.getByPlaceholder("주소를 붙여 넣거나 글 찾기"), "react.dev/learn");
		await expect.element(page.getByRole("option", { name: /react\.dev\/learn/ })).toBeVisible();
	});
});

/** The editor on a draft whose read does not answer until `release`, as on a slow connection. */
function heldRead() {
	const held = { release: () => {} };
	const gate = new Promise<void>((done) => {
		held.release = done;
	});
	const [load] = entry.site("draft") as [() => Promise<Loaded>];
	const made = scene<Loaded>(
		{
			loaders: [
				async () => {
					const loaded = await load();
					const { transport } = loaded.site;
					loaded.site.transport = async (name, input, options) => {
						if (name === "entries.get") await gate;
						return transport(name, input, options);
					};
					return loaded;
				},
			],
		},
		entry.default,
	);
	return { ...made, release: () => held.release() };
}

describe("the entry editor: before the entry is there", () => {
	it("02 T153 nothing of the entry can be changed before it is read: keys pressed where the title stands are not taken, and the saved title comes with no change counted", async () => {
		const story = heldRead();
		await story.run();
		// The screen is drawn (its way back), the entry is not read yet.
		await expect.element(button("게시글")).toBeVisible();
		// Nothing that writes is there: no title to type into (it would read as an untitled entry), no save, no publish, no menu of the entry's actions.
		expect(title().elements()).toEqual([]);
		for (const name of ["저장", "발행하기", "더 보기", "속성"]) expect(button(name).elements()).toEqual([]);
		// Nor the languages: "+ 언어" made a translation of an entry nobody had read, and the tabs moved when the entry came.
		for (const name of ["한국어", "+ 언어"]) expect(button(name).elements()).toEqual([]);
		// No status bar either: nothing is said of an entry that is not there.
		expect(document.querySelector("[data-slot=status-bar]")).toBeNull();
		// The site's structure is read by now (the way back is named from it), so the properties could be drawn, empty: they are not. No field of theirs
		// takes a letter, and no file can be chosen or sent up for an entry that is not there.
		const property = (name: string) => page.getByLabelText(name, { exact: true });
		for (const name of ["요약", "대표 이미지"]) expect(property(name).elements()).toEqual([]);
		expect(page.getByRole("tablist").elements()).toEqual([]);
		// A press where the title stands once it is read, then keys, then ⌘S.
		const at = { x: 500, y: 148 };
		await userEvent.click(page.elementLocator(document.elementFromPoint(at.x, at.y) as HTMLElement));
		await userEvent.keyboard("먼저 친 글자");
		await save();
		story.release();
		await opened();
		const box = title().element().getBoundingClientRect();
		expect(at.x > box.left && at.x < box.right && at.y > box.top && at.y < box.bottom).toBe(true);
		await expect.element(title()).toHaveValue("첫 번째 글");
		await expect.element(button("속성")).toBeVisible();
		await expect.element(button("+ 언어")).toBeVisible();
		await expect.element(property("요약")).toHaveValue("리액트로 블로그를 다시 만들며 덜어낸 것과 남긴 것.");
		await expect.element(property("대표 이미지")).toBeVisible();
		await saveCell("저장됨");
		await expect.element(button("저장 전 변경사항")).not.toBeInTheDocument();
		const { site, id } = story.loaded();
		const read = (await site.monti.run("entries.get", { id }, entry.admin)) as {
			entry: { title: string; version: number };
		};
		expect([read.entry.title, read.entry.version]).toEqual(["첫 번째 글", 1]);
		// Once it is there, it takes input as ever.
		await titleEnd();
		await userEvent.keyboard(" 다시");
		await expect.element(title()).toHaveValue("첫 번째 글 다시");
		await saveCell("저장 전 변경사항");
	});
});

/**
 * The editor on an entry of this kind, with what an operation answers decided as the test goes: `cut(name)` says what happens to a call (`"none"`: no
 * answer at all, as `fetch` throws with no network; `"refused"`: a 500 with no reason of its own; `"signedOut"`: the session has ended;
 * `"held"`: no answer until `release`).
 */
function wired(kind: Parameters<typeof entry.site>[0]) {
	const wire: {
		cut: (name: string) => "none" | "refused" | "signedOut" | "held" | undefined;
		release: () => void;
		calls: string[];
	} = {
		cut: () => undefined,
		release: () => {},
		calls: [],
	};
	const gate = new Promise<void>((done) => {
		wire.release = done;
	});
	const [load] = entry.site(kind) as [() => Promise<Loaded>];
	const made = scene<Loaded>(
		{
			loaders: [
				async () => {
					const loaded = await load();
					const { transport } = loaded.site;
					loaded.site.transport = async (name, input, options) => {
						const cut = wire.cut(name);
						if (cut === "none") throw new TypeError("Failed to fetch");
						if (cut === "refused") return { status: 500, body: { error: "unexpected" } };
						if (cut === "signedOut") return { status: 401, body: { error: "unauthenticated" } };
						if (cut === "held") await gate;
						const answer = await transport(name, input, options);
						wire.calls.push(name);
						return answer;
					};
					return loaded;
				},
			],
		},
		entry.default,
	);
	return { ...made, wire };
}

describe("the entry editor: an answer that does not come", () => {
	// Each of these ends with a toast on the page: it would lie over what the next test presses.
	afterEach(() => {
		toast.dismiss();
	});
	const savedTitle = async (story: ReturnType<typeof wired>) => {
		const { site, id } = story.loaded();
		return ((await site.monti.run("entries.get", { id }, entry.admin)) as { entry: { title: string } }).entry.title;
	};
	/** A conflict: the entry was saved elsewhere while a change waited here. */
	async function conflict(story: ReturnType<typeof wired>) {
		await story.run();
		await opened();
		await titleEnd();
		await userEvent.keyboard(" 내가 쓴 말");
		const { site, id } = story.loaded();
		await site.monti.run("entries.save", { id, version: 1, title: "다른 탭의 제목" }, entry.admin);
		await save();
		await expect.element(page.getByText(/먼저 저장했습니다/)).toBeVisible();
	}

	for (const answer of ["none", "refused"] as const)
		it(`02 '서버 최신본 불러오기' whose read ${answer === "none" ? "gets no answer" : "is refused"} throws nothing away: my changes and the conflict stay, and a toast says the entry was not read`, async () => {
			const story = wired("draft");
			await conflict(story);
			story.wire.cut = (name) => (name === "entries.get" ? answer : undefined);
			await userEvent.click(button("서버 최신본 불러오기"));
			await expect.element(page.getByText("글을 불러오지 못했습니다")).toBeVisible();
			// Nothing went on from the read that did not come: what I wrote is here, and the banner still asks.
			await expect.element(title()).toHaveValue("첫 번째 글 내가 쓴 말");
			await expect.element(page.getByText(/먼저 저장했습니다/)).toBeVisible();
			await saveCell("편집 충돌");
			// With the network back, the same button reads the latest.
			story.wire.cut = () => undefined;
			await userEvent.click(button("서버 최신본 불러오기"));
			await expect.element(title()).toHaveValue("다른 탭의 제목");
			await expect.element(page.getByText(/먼저 저장했습니다/)).not.toBeInTheDocument();
		});

	it("02 from the compare screen, a latest that is not read leaves the comparison open with what it compares", async () => {
		const story = wired("draft");
		await conflict(story);
		await userEvent.click(button("비교하기"));
		await expect.element(page.getByText("서버 최신본과 비교")).toBeVisible();
		story.wire.cut = (name) => (name === "entries.get" ? "none" : undefined);
		await userEvent.click(button("서버 최신본 불러오기"));
		await expect.element(page.getByText("글을 불러오지 못했습니다")).toBeVisible();
		await expect.element(page.getByText("서버 최신본과 비교")).toBeVisible();
	});

	it("02 a save that went through, its read again getting no answer: what I wrote stays on the screen, and a toast says the entry was saved but not read again", async () => {
		const story = wired("draft");
		await story.run();
		await opened();
		await titleEnd();
		await userEvent.keyboard(" 저장한 말");
		story.wire.cut = (name) => (name === "entries.get" ? "none" : undefined);
		await save();
		await expect.element(page.getByText("저장했지만 글을 다시 읽지 못했습니다")).toBeVisible();
		expect(await savedTitle(story)).toBe("첫 번째 글 저장한 말");
		// The screen still has the copy from before the save: my words stay over it, not the old title in their place.
		await expect.element(title()).toHaveValue("첫 번째 글 저장한 말");
		await saveCell("저장 전 변경사항");
	});

	it("02 after a save that was not read again, the next save is mine: it goes through, with no conflict against my own save", async () => {
		const story = wired("draft");
		await story.run();
		await opened();
		await titleEnd();
		await userEvent.keyboard(" 저장한 말");
		story.wire.cut = (name) => (name === "entries.get" ? "none" : undefined);
		await save();
		await expect.element(page.getByText("저장했지만 글을 다시 읽지 못했습니다")).toBeVisible();
		// The server answers again. What is on the screen was written on the version my own save made.
		story.wire.cut = () => undefined;
		await userEvent.click(title());
		await userEvent.keyboard("{End}, 그리고 더");
		await save();
		await saveCell("저장됨");
		expect(page.getByText(/먼저 저장했습니다/).elements()).toEqual([]);
		await expect.element(title()).toHaveValue("첫 번째 글 저장한 말, 그리고 더");
		expect(await savedTitle(story)).toBe("첫 번째 글 저장한 말, 그리고 더");
	});

	it("02 the comparison whose own read does not come says so at its top with a way to try again, and its way back stays", async () => {
		const story = wired("draft");
		await conflict(story);
		story.wire.cut = (name) => (name === "entries.get" ? "none" : undefined);
		await userEvent.click(button("비교하기"));
		await expect.element(page.getByText("글을 불러오지 못했습니다")).toBeVisible();
		await expect.element(button("편집기로")).toBeVisible();
		story.wire.cut = () => undefined;
		await userEvent.click(button("다시 시도"));
		await expect.element(page.getByText("서버 최신본과 비교")).toBeVisible();
		await expect.element(page.getByText("글을 불러오지 못했습니다")).not.toBeInTheDocument();
		// And back to the editor from a comparison that never came.
		story.wire.cut = (name) => (name === "entries.get" ? "refused" : undefined);
		await userEvent.click(button("편집기로"));
		await userEvent.click(button("비교하기"));
		await expect.element(page.getByText("글을 불러오지 못했습니다")).toBeVisible();
		await userEvent.click(button("편집기로"));
		await expect.element(title()).toHaveValue("첫 번째 글 내가 쓴 말");
	});

	it("15 a read again that finds the session ended says so once, in the session's banner: no toast of the save or of the latest beside it", async () => {
		const story = wired("draft");
		await story.run();
		await opened();
		await titleEnd();
		await userEvent.keyboard(" 저장한 말");
		story.wire.cut = (name) => (name === "entries.get" ? "signedOut" : undefined);
		await save();
		await expect.element(page.getByText("로그인이 풀렸습니다")).toBeVisible();
		expect(await savedTitle(story)).toBe("첫 번째 글 저장한 말");
		expect(page.getByText("저장했지만 글을 다시 읽지 못했습니다").elements()).toEqual([]);
		await expect.element(title()).toHaveValue("첫 번째 글 저장한 말");
	});

	it("15 '서버 최신본 불러오기' that finds the session ended keeps my changes and adds no toast to the session's banner", async () => {
		const story = wired("draft");
		await conflict(story);
		story.wire.cut = (name) => (name === "entries.get" ? "signedOut" : undefined);
		await userEvent.click(button("서버 최신본 불러오기"));
		await expect.element(page.getByText("로그인이 풀렸습니다")).toBeVisible();
		expect(page.getByText("글을 불러오지 못했습니다").elements()).toEqual([]);
		await expect.element(title()).toHaveValue("첫 번째 글 내가 쓴 말");
	});

	it("00 a save that gets no answer says so in words of its own, and a refusal with no reason says only that something went wrong: no code, no empty place", async () => {
		const story = wired("draft");
		await story.run();
		await opened();
		await titleEnd();
		await userEvent.keyboard(" 다시");
		story.wire.cut = (name) => (name === "entries.save" ? "none" : undefined);
		await save();
		await expect.element(page.getByText("서버가 답하지 않았습니다", { exact: true })).toBeVisible();
		story.wire.cut = (name) => (name === "entries.save" ? "refused" : undefined);
		await save();
		await expect.element(page.getByText("문제가 생겼습니다", { exact: true })).toBeVisible();
		expect(document.body.textContent).not.toContain("{message}");
		expect(document.body.textContent).not.toContain("network");
		await expect.element(title()).toHaveValue("첫 번째 글 다시");
	});
});

describe("the entry editor: the assistant's proposals before the entry is read", () => {
	it("05 T153 the bubble and its keys wait for the entry: before the read nothing takes or discards a proposal nobody has seen", async () => {
		const story = wired("proposed");
		story.wire.cut = (name) => (name === "entries.get" ? "held" : undefined);
		await story.run();
		const pending = () =>
			story
				.loaded()
				.site.monti.run("proposals.forTarget", { kind: "entry", id: story.loaded().id }, entry.admin) as Promise<
				{ id: string }[]
			>;
		// The proposals are read (they do not wait for the entry), the entry is not.
		await expect.poll(() => story.wire.calls).toContain("proposals.forTarget");
		const before = (await pending()).map((item) => item.id);
		expect(before.length).toBeGreaterThan(0);
		expect(button("모두 버리기").elements()).toEqual([]);
		expect(button("모두 받기").elements()).toEqual([]);
		await userEvent.keyboard("{Meta>}{Backspace}{/Meta}");
		await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
		await new Promise((done) => setTimeout(done, 100));
		expect((await pending()).map((item) => item.id)).toEqual(before);
		story.wire.release();
		await opened();
		await expect.element(button("모두 버리기")).toBeVisible();
		expect((await pending()).map((item) => item.id)).toEqual(before);
	});
});

describe("the entry editor: the focus after a read that did not come", () => {
	/** The keyboard's focus on a button, as Tab leaves it: a key first, so the focus set next is the keyboard's. */
	async function byKeys(name: string) {
		await userEvent.keyboard("{Shift}");
		(button(name).element() as HTMLElement).focus();
		expect(button(name).element().matches(":focus-visible")).toBe(true);
	}

	it("00 '다시 시도' pressed with the keyboard: once the entry is in, the focus is in the text, not on the page", async () => {
		const story = wired("draft");
		story.wire.cut = (name) => (name === "entries.get" ? "none" : undefined);
		await story.run();
		await expect.element(page.getByText("글을 불러오지 못했습니다")).toBeVisible();
		story.wire.cut = () => undefined;
		await byKeys("다시 시도");
		await userEvent.keyboard("{Enter}");
		await expect.element(title()).toHaveValue("첫 번째 글");
		await expect.element(body()).toHaveFocus();
	});

	it("00 '다시 시도' pressed with the pointer moves no focus: the entry comes in and the keyboard is given to nothing", async () => {
		const story = wired("draft");
		story.wire.cut = (name) => (name === "entries.get" ? "none" : undefined);
		await story.run();
		await expect.element(page.getByText("글을 불러오지 못했습니다")).toBeVisible();
		story.wire.cut = () => undefined;
		await userEvent.click(button("다시 시도"));
		await opened();
		await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 50))));
		await expect.element(body()).not.toHaveFocus();
		await expect.element(title()).not.toHaveFocus();
	});

	it("02 the comparison's '다시 시도' pressed with the keyboard: once it is read, the focus is on the comparison's first control", async () => {
		const story = wired("draft");
		await story.run();
		await opened();
		await titleEnd();
		await userEvent.keyboard(" 내가 쓴 말");
		const { site, id } = story.loaded();
		await site.monti.run("entries.save", { id, version: 1, title: "다른 탭의 제목" }, entry.admin);
		await save();
		await expect.element(page.getByText(/먼저 저장했습니다/)).toBeVisible();
		story.wire.cut = (name) => (name === "entries.get" ? "none" : undefined);
		await userEvent.click(button("비교하기"));
		await expect.element(page.getByText("글을 불러오지 못했습니다")).toBeVisible();
		story.wire.cut = () => undefined;
		await byKeys("다시 시도");
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByText("서버 최신본과 비교")).toBeVisible();
		await expect.element(button("편집기로")).toHaveFocus();
	});

	it("02 an answer given in the comparison with the keyboard takes it away, and the focus goes to the text", async () => {
		await BrowserCopy.run();
		await opened();
		await userEvent.click(button("비교하기"));
		await expect.element(page.getByText("임시 저장본과 비교")).toBeVisible();
		await byKeys("버리기");
		await userEvent.keyboard("{Enter}");
		await opened();
		await expect.element(page.getByText("이 브라우저에 저장하지 않은 편집이 있습니다")).not.toBeInTheDocument();
		await expect.element(body()).toHaveFocus();
	});
});

describe("the entry editor: the stories of the states before the read", () => {
	it("02 T153 'BeforeTheRead' and 'ReadFailed' draw what a person meets there: the way back, and for a failed read the banner with its way to try again", async () => {
		await from(entry.BeforeTheRead).run();
		await expect.element(button("게시글")).toBeVisible();
		expect(title().elements()).toEqual([]);
		// Not read yet is not a failure: no banner asks to try again.
		expect(button("다시 시도").elements()).toEqual([]);

		await from(entry.ReadFailed).run();
		await expect.element(page.getByText("글을 불러오지 못했습니다")).toBeVisible();
		await expect.element(button("다시 시도")).toBeVisible();
		expect(title().elements()).toEqual([]);
	});
});

describe("the entry editor: a banner's answer and the focus", () => {
	it("02 T135 '버리기' pressed with the keyboard while there is no body yet: the focus goes to the title, not to the page", async () => {
		const held = { release: () => {} };
		const gate = new Promise<void>((done) => {
			held.release = done;
		});
		const [load] = entry.BrowserCopy.loaders as [() => Promise<Loaded>];
		await scene<Loaded>(
			{
				loaders: [
					async () => {
						const loaded = await load();
						const { transport } = loaded.site;
						loaded.site.transport = async (name, input, options) => {
							// The blocks the body is made of are not read yet: the entry is there, its body is not drawn.
							if (name === "blocks.catalog") await gate;
							return transport(name, input, options);
						};
						return loaded;
					},
				],
			},
			entry.default,
		).run();
		await expect.element(title()).toBeVisible();
		expect(body().elements()).toEqual([]);
		const drop = button("버리기");
		await expect.element(drop).toBeVisible();
		// The keyboard's focus, as Tab leaves it.
		await userEvent.keyboard("{Shift}");
		(drop.element() as HTMLElement).focus();
		expect(drop.element().matches(":focus-visible")).toBe(true);
		await userEvent.keyboard("{Enter}");
		await expect.element(drop).not.toBeInTheDocument();
		await expect.element(title()).toHaveFocus();
		held.release();
		await expect.element(body()).toBeVisible();
	});
});

describe("the entry editor: a read that gets no answer", () => {
	it("00 a read the network cuts off is a refusal like any other: the screen says the entry did not load, and '다시 시도' reads it", async () => {
		let cut = true;
		const [load] = entry.site("draft") as [() => Promise<Loaded>];
		const story = scene<Loaded>(
			{
				loaders: [
					async () => {
						const loaded = await load();
						const { transport } = loaded.site;
						loaded.site.transport = async (name, input, options) => {
							// As `fetch` does when there is no network: it throws, it does not answer.
							if (name === "entries.get" && cut) throw new TypeError("Failed to fetch");
							return transport(name, input, options);
						};
						return loaded;
					},
				],
			},
			entry.default,
		);
		await story.run();
		await expect.element(page.getByText("글을 불러오지 못했습니다")).toBeVisible();
		expect(title().elements()).toEqual([]);
		// As before the read: none of the entry's controls, the properties button among them (it stood pressed and opened nothing), nor the languages.
		for (const name of ["저장", "발행하기", "더 보기", "속성", "한국어", "+ 언어"])
			expect(button(name).elements()).toEqual([]);
		cut = false;
		await userEvent.click(button("다시 시도"));
		await expect.element(title()).toHaveValue("첫 번째 글");
		await expect.element(page.getByText("글을 불러오지 못했습니다")).not.toBeInTheDocument();
	});
});

describe("the entry editor: tables", () => {
	it("T62 '/' and '표' put in an empty table: three columns under a head row, the caret in its first cell", async () => {
		await on("new").run();
		await opened();
		await userEvent.click(body());
		await userEvent.keyboard("/표");
		await userEvent.click(page.getByRole("option", { name: /^표/ }));
		await expect.poll(() => within("th")).toHaveLength(3);
		expect(within("tr")).toHaveLength(3);
		await userEvent.keyboard("버전");
		await expect.poll(() => within("th")[0]?.textContent).toBe("버전");
		await expect.element(button("1번째 열")).toBeVisible();
	});

	it("a column put in from the column's menu: four columns, and the save keeps the table as rows of text", async () => {
		const story = from(entry.TableColumnMenu);
		await story.run();
		await userEvent.click(page.getByRole("menuitem", { name: "오른쪽에 열 넣기" }));
		await expect.poll(() => cells()[0]).toEqual(["버전", "바뀐 것", "", "날짜"]);
		expect(fitsBody()).toBe(true);
		await save();
		await saveCell("저장됨");
		const table = (await kept(story.loaded())).find((block) => block.type === "table");
		expect(table?.attrs?.rows).toEqual([
			["버전", "바뀐 것", "", "날짜"],
			["1.0", "처음 공개", "", "2024-03-02"],
			["2.0", "편집기 다시 만들기", "", "2025-11-20"],
		]);
		expect(table?.attrs?.header).toBe(true);
	});

	it("a table whose columns were sized: each keeps its share of the body, and the table is as wide as the body", async () => {
		await on("tableSized").run();
		await opened();
		await expect.poll(shares).toEqual(["20%", "50%", "30%"]);
		expect(fitsBody()).toBe(true);
	});

	it("a column put into a sized table gets an even share, the others make room in proportion, and the table stays the body's width", async () => {
		await on("tableSized").run();
		await opened();
		await userEvent.click(cell("편집기 다시 만들기"));
		await userEvent.click(page.getByRole("button", { name: "2번째 열", exact: true }));
		await userEvent.click(page.getByRole("menuitem", { name: "오른쪽에 열 넣기" }));
		await expect.poll(shares).toEqual(["15%", "37.5%", "25%", "22.5%"]);
		expect(fitsBody()).toBe(true);
	});

	it("[dragging] [dropped] a border held and dragged follows the pointer; let go, only the two columns beside it trade width, and the table stays the body's width", async () => {
		await on("tableSized").run();
		await opened();
		await userEvent.click(cell("처음 공개"));
		const border = button("1·2번째 열 너비");
		await expect.element(border).toBeInTheDocument();
		const from = middleOf(border.element());
		const width = within("table")[0]?.getBoundingClientRect().width ?? 0;
		await dragPath([from, { x: from.x + width * 0.1, y: from.y }], { hold: true });
		// The line follows the pointer; the widths change when it is let go.
		await expect.poll(() => Math.abs(middleOf(border.element()).x - (from.x + width * 0.1))).toBeLessThanOrEqual(2);
		expect(shares()).toEqual(["20%", "50%", "30%"]);
		await dropDrag();
		await expect.poll(shares).toEqual(["30%", "40%", "30%"]);
		expect(fitsBody()).toBe(true);
	});
});

describe("the entry editor: footnotes", () => {
	it("words picked and the footnote button pressed: a number after them, its footnote at the end with the caret in it, the others renumbered; the save keeps both", async () => {
		const story = on("footnotes");
		await story.run();
		await opened();
		await pickWords(body().element(), "지금 상태만");
		await userEvent.click(button("각주"));
		await userEvent.keyboard("상태 말고는 덜어냈다.");
		await expect.poll(notes).toEqual({
			refs: ["1", "2", "3"],
			notes: [
				"1. 상태 말고는 덜어냈다.",
				"2. 상태는 색 대신 글자로 적었다.",
				"3. 처음 판은 정적 사이트 생성기로 만들었다.",
			],
		});
		await save();
		await saveCell("저장됨");
		const blocks = await kept(story.loaded());
		expect(blocks.filter((block) => block.type === "footnote")).toHaveLength(3);
		expect(blocks[0]?.content?.some((part) => part.type === "footnoteRef")).toBe(true);
	});

	it("a footnote's number taken out of the text: the footnote goes with it, and the rest are renumbered", async () => {
		await on("footnotes").run();
		await opened();
		await expect.poll(() => notes().refs).toEqual(["1", "2"]);
		// The first number ends its line: a press just past it puts the caret after it.
		const ref = within("[data-footnote-ref]")[0];
		const line = ref?.parentElement;
		if (!ref || !line) throw new Error("no footnote reference");
		const [at, box] = [ref.getBoundingClientRect(), line.getBoundingClientRect()];
		await userEvent.click(page.elementLocator(line), {
			position: { x: at.right + 6 - box.left, y: at.top + at.height / 2 - box.top },
		});
		await userEvent.keyboard("{Backspace}");
		await expect.poll(notes).toEqual({ refs: ["1"], notes: ["1. 처음 판은 정적 사이트 생성기로 만들었다."] });
	});

	it("a reference's number pressed: the caret goes to its footnote", async () => {
		await on("footnotes").run();
		await opened();
		await expect.poll(() => notes().refs).toEqual(["1", "2"]);
		const ref = within("[data-footnote-ref]")[0];
		if (!ref) throw new Error("no footnote reference");
		await userEvent.click(page.elementLocator(ref));
		await expect
			.poll(() =>
				document.getSelection()?.anchorNode?.parentElement?.closest("[data-footnote]")?.getAttribute("data-n"),
			)
			.toBe("1");
	});
});

describe("the entry editor: the assistant's proposals in the body (T32)", () => {
	const proposals = () =>
		story.loaded().site.monti.run("proposals.forTarget", { kind: "entry", id: story.loaded().id }, entry.admin);
	let story = on("proposed");
	async function proposed() {
		story = on("proposed");
		await story.run();
		await opened();
		await expect.poll(() => within("ins")).toHaveLength(2);
	}

	it("⌘↵ takes the proposal looked at: the words change, the change is unsaved, and the save marks the proposal applied", async () => {
		await proposed();
		await userEvent.click(title());
		await userEvent.click(body());
		await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
		await expect.poll(() => body().element().textContent).toContain("블로그를 다시 만든 건");
		expect(within("ins")).toHaveLength(1);
		await saveCell("저장 전 변경사항");
		await save();
		await saveCell("저장됨");
		expect(await proposals()).toHaveLength(2);
	});

	it("'모두 받기' puts every proposal into the text at once, unsaved", async () => {
		await proposed();
		await userEvent.click(button("모두 받기"));
		await expect.poll(() => body().element().textContent).toContain("상태도 색 대신 글자로 적었다.");
		const text = body().element().textContent;
		expect(text).toContain("블로그를 다시 만든 건");
		expect(text).not.toContain("편집기도 같은 원칙으로");
		expect(within("ins, del")).toHaveLength(0);
		await saveCell("저장 전 변경사항");
	});

	it("typing in a block a proposal touches takes that proposal first, then the typing goes over it", async () => {
		await proposed();
		await caretAfter(body().element(), "때문이다");
		await userEvent.keyboard("!");
		await expect.poll(() => body().element().textContent).toContain("블로그를 다시 만든 건");
		expect(body().element().textContent).toContain("때문이다!");
	});

	it("focus: '모두 버리기' pressed with the keyboard: the bubble goes, and the focus is in the text it sat over", async () => {
		await proposed();
		await userEvent.keyboard("{Tab}");
		(button("모두 버리기").element() as HTMLElement).focus();
		expect(button("모두 버리기").element().matches(":focus-visible")).toBe(true);
		await userEvent.keyboard("{Enter}");
		await expect.element(button("모두 받기")).not.toBeInTheDocument();
		await expect.poll(() => body().element().contains(document.activeElement)).toBe(true);
	});

	it("'모두 버리기': the proposals are gone from the text and the bubble with them; nothing changed", async () => {
		await proposed();
		await userEvent.click(button("모두 버리기"));
		await expect.poll(() => within("ins, del")).toHaveLength(0);
		await expect.element(button("모두 받기")).not.toBeInTheDocument();
		await saveCell("저장됨");
	});
});
