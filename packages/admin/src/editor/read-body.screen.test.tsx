import type { Block, Doc } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { scene } from "../../test/scene";
import * as read from "./read-body.stories";
import {
	BLOCKS,
	BROKEN,
	FOLDED,
	IMAGES,
	MINE,
	MOVED_A,
	MOVED_B,
	paragraph,
	THEIRS,
	TODO,
	text,
} from "./test/read-body-docs";

const Compared = scene<read.Loaded>({ loaders: read.read(MINE, THEIRS) }, read.default);

const Blocks = scene<read.Loaded>({ loaders: read.read(BLOCKS, null) }, read.default);

const Todo = scene<read.Loaded>({ loaders: read.read(TODO, null) }, read.default);

const Failed = scene<read.Loaded>({ loaders: read.read(MINE, THEIRS, { failCatalog: true }) }, read.default);
const Streaming = scene<read.Loaded>(
	{ loaders: read.read({ type: "doc", blocks: [FOLDED] }, null, { streaming: true }) },
	read.default,
);

const Moved = scene<read.Loaded>({ loaders: read.read(MOVED_A, MOVED_B) }, read.default);

const Broken = scene<read.Loaded>({ loaders: read.read(BROKEN, null) }, read.default);

const Pictures = scene<read.Loaded>({ loaders: read.read(IMAGES("빌드 시간"), IMAGES("속도")) }, read.default);

const Chat = scene<read.Loaded>({ loaders: read.read(MINE, null, { size: "chat" }) }, read.default);
const Lifted = scene<read.Loaded>(
	{
		loaders: read.read({ type: "doc", blocks: [...MINE.blocks, ...IMAGES("빌드 시간").blocks] }, null, {
			muted: true,
			ground: "tool",
		}),
	},
	read.default,
);
const Reading = scene<read.Loaded>({ loaders: read.read(MINE, null) }, read.default);
const StreamingChat = scene<read.Loaded>(
	{ loaders: read.read({ type: "doc", blocks: MINE.blocks.slice(0, 2) }, null, { size: "chat", streaming: true }) },
	read.default,
);
const TodoInEditable = scene<read.Loaded>({ loaders: read.read(TODO, null, { inEditable: true }) }, read.default);
const Thrown = scene<read.Loaded>(
	{
		loaders: read.read(
			{
				type: "doc",
				blocks: [paragraph("ok", text("그려지는 문단")), MINE.blocks[3] as Block, { id: "bare", type: "" }] as Block[],
			} as Doc,
			null,
			{ breakSite: "callout" },
		),
	},
	read.default,
);
const Named = scene<read.Loaded>(
	{ loaders: read.read(IMAGES("빌드 시간"), null, { media: [{ id: "m1", name: "build.png" }] }) },
	read.default,
);

const sides = () => [...document.querySelectorAll<HTMLElement>("[data-slot=compare-side]")];
const marked = (side: HTMLElement) =>
	[...side.querySelectorAll("[data-slot=highlight]")].map((each) => each.textContent?.trim());

describe("a body read without being written draws as the editor draws it", () => {
	it("[reach] bold, a link, inline code and a heading's level keep their elements, and the changed words are marked on both sides", async () => {
		await Compared.run();
		await expect.poll(() => sides()[0]?.querySelector("strong")).not.toBeNull();
		const [mine, theirs] = sides() as [HTMLElement, HTMLElement];
		expect(mine.querySelector("strong")?.textContent).toContain("둘");
		expect(mine.querySelector("a")?.getAttribute("href")).toBe("https://example.dev/docs");
		expect(mine.querySelector(":not(pre) > code")?.textContent).toBe("npm");
		// A third-level heading stays one, whatever the screen it is read on.
		expect(mine.querySelector("h3")?.textContent).toBe("새 제목");
		// The same mark on both sides, over the words that differ.
		expect(marked(mine)).toContain("둘");
		expect(marked(theirs)).toContain("하나");
		expect(theirs.querySelector("strong")?.textContent).toContain("하나");
	});

	it("[reach] a code block keeps its head, its line effects and the site's colours, and its changed words are marked", async () => {
		await Compared.run();
		await expect.poll(() => sides()[0]?.querySelector("[data-slot=code-frame]")).not.toBeNull();
		const [mine, theirs] = sides() as [HTMLElement, HTMLElement];
		const frame = mine.querySelector("[data-slot=code-frame]") as HTMLElement;
		expect(frame.textContent).toContain("src/counter.ts");
		expect(frame.querySelector("[data-slot=code-number][data-tone=plus]")).not.toBeNull();
		await expect.poll(() => frame.querySelectorAll("[data-token]").length).toBeGreaterThan(0);
		expect(marked(mine).some((words) => words?.includes("++"))).toBe(true);
		expect(marked(theirs).some((words) => words?.includes("--"))).toBe(true);
	});

	it("[reach] a site's blocks are drawn by their own drawing, and the changed words inside them and in a formula's source are marked", async () => {
		await Compared.run();
		await expect.poll(() => sides()[0]?.querySelector("[data-block=callout] [role=note]")).not.toBeNull();
		const [mine, theirs] = sides() as [HTMLElement, HTMLElement];
		expect(mine.querySelector("[data-block=callout]")?.textContent).toContain("콜아웃 본문입니다");
		expect(marked(theirs).some((words) => words?.includes("다르게"))).toBe(true);
		// A formula is drawn, and its source, where it differs, is read as code with the words marked.
		expect(mine.querySelector("[data-block=math]")?.textContent).not.toBe("");
		expect(marked(mine).some((words) => words?.includes("c^2"))).toBe(true);
	});

	it("[reach] read-only code draws a rule's text styles and a tooltip as the editor does, and a closed fold stays folded until it is opened", async () => {
		await Compared.run();
		await expect.poll(() => sides()[0]?.querySelectorAll("[data-slot=code-frame]").length).toBe(3);
		const frame = [...(sides()[0]?.querySelectorAll<HTMLElement>("[data-slot=code-frame]") ?? [])].find((each) =>
			each.textContent?.includes("function reset"),
		) as HTMLElement;
		expect(frame.querySelector("[data-effect=bold]")?.textContent).toBe("count");
		expect(frame.querySelector("[data-monti-mark=codeTip]")?.textContent).toBe("add");
		expect(frame.querySelector("[data-monti-mark=codeTip]")?.getAttribute("title")).toBe("더하기");
		// The fold's lines are hidden and its summary stands in their place, with the editor's own button to open it.
		expect(frame.querySelectorAll("[data-code-hidden]").length).toBeGreaterThan(0);
		const numbers = () => frame.querySelectorAll("[data-slot=code-number]").length;
		expect(numbers()).toBe(3);
		const open = frame.querySelector("[data-slot=code-aside] button") as HTMLButtonElement;
		expect(open.textContent).toBe("접힌 2줄");
		open.click();
		await expect.poll(numbers).toBe(5);
		expect(frame.querySelectorAll("[data-code-hidden]").length).toBe(0);
	});

	it("[reach] a site's blocks are given the blocks they hold: tabs keep their labels, a code explorer its tree and file names, columns their count", async () => {
		await Blocks.run();
		await expect.poll(() => sides()[0]?.querySelector("[role=tab]")).not.toBeNull();
		const [side] = sides() as [HTMLElement];
		expect([...side.querySelectorAll("[role=tab]")].map((tab) => tab.textContent)).toEqual(["npm", "pnpm"]);
		// The explorer names its files in its own list, and its frames do not say them again.
		expect(side.querySelector("[data-block=codeExplorer]")?.textContent).toContain("app.ts");
		expect(side.querySelector("[data-block=codeExplorer]")?.textContent).toContain("db.ts");
		const columns = side.querySelector("[data-block=columns] > *") as HTMLElement;
		const tracks = getComputedStyle(columns).gridTemplateColumns.split(" ").length;
		expect(tracks).toBe(2);
	});

	it("[reach] two blocks that swapped places are marked on both sides, though their words are the same", async () => {
		await Moved.run();
		await expect.poll(() => sides()[0]?.querySelectorAll("[data-slot=highlight]").length).toBeGreaterThan(0);
		for (const side of sides()) expect(marked(side).sort()).toEqual(["둘째 문단", "첫째 문단"].sort());
	});

	it("[reach] a to-do's box says its state and its item, read only, and a link to a place of the admin is left to the browser when pressed with Cmd or Ctrl", async () => {
		await Todo.run();
		await expect.poll(() => sides()[0]?.querySelectorAll("[role=checkbox]").length).toBe(2);
		const [side] = sides() as [HTMLElement];
		const boxes = [...side.querySelectorAll<HTMLElement>("[role=checkbox]")];
		expect(
			boxes.map((box) => [
				box.getAttribute("aria-label"),
				box.getAttribute("aria-checked"),
				box.getAttribute("aria-readonly"),
			]),
		).toEqual([
			["초안 쓰기", "true", "true"],
			["발행하기", "false", "true"],
		]);
		const link = side.querySelector("a") as HTMLAnchorElement;
		const opened = Todo.loaded().opened;
		// Whether the page's own handler took the press; the browser's own (leaving for the address) is stopped after it, so the test stays where it is.
		const press = (init: MouseEventInit) => {
			let taken = false;
			const watch = (event: Event) => {
				taken = event.defaultPrevented;
				event.preventDefault();
			};
			document.addEventListener("click", watch, { once: true });
			link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init }));
			document.removeEventListener("click", watch);
			return taken;
		};
		expect(press({ ctrlKey: true })).toBe(false);
		expect(press({ metaKey: true })).toBe(false);
		expect(opened).toEqual([]);
		expect(press({})).toBe(true);
		expect(opened).toEqual(["#/c/post/abc"]);
	});

	it("with no catalog the bodies are their words, not blank, and a block that cannot be made is a box while the others are drawn", async () => {
		await Failed.run();
		await expect.poll(() => sides()[0]?.textContent).toContain("버튼을 누를 때마다");
		expect(sides()[1]?.textContent).toContain("버튼을 누를 때마다");
		await Broken.run();
		await expect.poll(() => sides()[0]?.textContent).toContain("그려지는 문단");
		expect(sides()[0]?.querySelector("[data-box]")).not.toBeNull();
	});

	it("[reach] a block drawn as a box says its values once: the changed ones are marked in the box, with no name line over it", async () => {
		await Pictures.run();
		await expect.poll(() => sides()[0]?.querySelector("[data-box]")).not.toBeNull();
		for (const side of sides()) {
			expect(side.querySelectorAll("[data-slot=compare-values]")).toHaveLength(0);
			expect(side.querySelector("[data-box] [data-slot=highlight]")).not.toBeNull();
		}
	});

	it("code still arriving is not coloured", async () => {
		await Streaming.run();
		await expect.poll(() => sides()[0]?.querySelectorAll("[data-slot=code-frame]").length).toBe(1);
		await new Promise((done) => setTimeout(done, 600));
		expect(sides()[0]?.querySelectorAll("[data-token]")).toHaveLength(0);
	});

	it("[reach] code read outside the editor is 12px, in the body's own block element, so the body's 20px gap applies and the chat's 8px", async () => {
		await Reading.run();
		await expect.poll(() => sides()[0]?.querySelector("[data-block=codeBlock]")).not.toBeNull();
		const block = sides()[0]?.querySelector("[data-block=codeBlock]") as HTMLElement;
		expect(getComputedStyle(block.querySelector("[data-slot=code-text]") as Element).fontSize).toBe("12px");
		expect(getComputedStyle(block.querySelector("[data-slot=code-number]") as Element).fontSize).toBe("12px");
		expect(getComputedStyle(block).marginBottom).toBe("20px");
		await Chat.run();
		await expect.poll(() => sides()[0]?.querySelector("[data-block=codeBlock]")).not.toBeNull();
		const inChat = sides()[0]?.querySelector("[data-block=codeBlock]") as HTMLElement;
		expect(getComputedStyle(inChat).marginBottom).toBe("8px");
		// An answer's code wraps, stands at most half the window high and has no numbers.
		expect(inChat.querySelector("[data-slot=code-number]")).toBeNull();
		expect(getComputedStyle(inChat.querySelector("[data-slot=code-text]") as Element).whiteSpace).toBe("pre-wrap");
		expect(getComputedStyle(inChat.querySelector("[data-slot=code-area]") as Element).maxHeight).toBe(
			`${window.innerHeight / 2}px`,
		);
	});

	it("[reach] a body has no room above its first block or under its last, in the chat too: the gap to what follows is the screen's", async () => {
		await Chat.run();
		await expect.poll(() => sides()[0]?.querySelector("[data-slot=editor-body]")).not.toBeNull();
		const body = sides()[0]?.querySelector("[data-slot=editor-body]") as HTMLElement;
		expect(getComputedStyle(body.firstElementChild as Element).marginTop).toBe("0px");
		expect(getComputedStyle(body.lastElementChild as Element).marginBottom).toBe("0px");
		// The block's own bottom edge is the body's: nothing hangs below it.
		expect(body.getBoundingClientRect().bottom).toBeCloseTo(
			(body.lastElementChild as HTMLElement).getBoundingClientRect().bottom,
			0,
		);
	});

	it("[reach] on the tool ground the code and the boxes are one step darker, and a muted body's code takes its quieter ink", async () => {
		await Lifted.run();
		await expect.poll(() => sides()[0]?.querySelector("[data-box]")).not.toBeNull();
		const reference = (name: string) => {
			const probe = document.createElement("span");
			probe.className = name;
			document.body.append(probe);
			const style = getComputedStyle(probe);
			const got = { background: style.backgroundColor, color: style.color };
			probe.remove();
			return got;
		};
		const side = sides()[0] as HTMLElement;
		const selected = reference("bg-monti-selected").background;
		expect(getComputedStyle(side.querySelector("[data-slot=code-frame]") as Element).backgroundColor).toBe(selected);
		expect(getComputedStyle(side.querySelector("[data-box]") as Element).backgroundColor).toBe(selected);
		expect(getComputedStyle(side.querySelector("[data-slot=code-text]") as Element).color).toBe(
			reference("text-monti-muted").color,
		);
	});

	it("[reach] the caret of an answer still arriving stands inside its last words, not on a line of its own", async () => {
		await StreamingChat.run();
		await expect.poll(() => sides()[0]?.querySelector("[data-slot=stream-caret]")).not.toBeNull();
		const caret = sides()[0]?.querySelector("[data-slot=stream-caret]") as HTMLElement;
		expect(caret.closest("p, li, h2, h3, h4, td")).not.toBeNull();
		expect(sides()[0]?.querySelectorAll("[data-slot=stream-caret]")).toHaveLength(1);
	});

	it("[reach] a to-do's box in a source cell inside written text shows no pointer and no hover ring", async () => {
		await TodoInEditable.run();
		await expect.poll(() => sides()[0]?.querySelector("[role=checkbox]")).not.toBeNull();
		const box = sides()[0]?.querySelector("[role=checkbox]") as HTMLElement;
		expect(getComputedStyle(box).cursor).not.toBe("pointer");
		await userEvent.hover(box);
		expect(getComputedStyle(box.querySelector("[data-check-box]") as Element).boxShadow).toBe("none");
	});

	it("[reach] a drawing that throws is that block's box while the others are drawn, and a block with no type says only that it is unknown", async () => {
		await Thrown.run();
		await expect.poll(() => sides()[0]?.textContent).toContain("그려지는 문단");
		const boxes = [...(sides()[0]?.querySelectorAll("[data-box]") ?? [])];
		expect(boxes).toHaveLength(2);
		expect(boxes.map((box) => box.textContent)).toContain("알 수 없는 블록");
	});

	it("[reach] pictures are named by their file when the body is not given its files", async () => {
		await Named.run();
		await expect.poll(() => sides()[0]?.querySelector("[data-box]")?.textContent).toContain("build.png");
	});
});
