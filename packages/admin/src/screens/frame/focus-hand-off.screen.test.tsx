import { composeStory } from "@storybook/react-vite";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { firstStop, focusText, nextStop, useFocusHandOff } from "./focus-hand-off";

describe("where the Tab key stops next", () => {
	const made: Element[] = [];
	const page = (html: string) => {
		const host = document.createElement("div");
		host.innerHTML = html;
		document.body.append(host);
		made.push(host);
		return host;
	};
	afterEach(() => {
		for (const host of made.splice(0)) host.remove();
	});

	it("after a banner it is the picked tab of a row the arrow keys move in, not the unpicked tab before it", () => {
		const host = page(`
			<div id="banner"><button id="again">다시 적용</button></div>
			<div role="tablist">
				<button role="tab" id="first" tabindex="-1" aria-selected="false">기본</button>
				<button role="tab" id="picked" tabindex="0" aria-selected="true">필드</button>
				<button role="tab" id="last" tabindex="-1" aria-selected="false">편집기</button>
			</div>
			<a href="#next" id="link">다음</a>`);
		const banner = host.querySelector("#banner") as Element;
		expect(nextStop(banner)?.id).toBe("picked");
	});

	it("it passes what the Tab key passes: a part's hidden input, what is off, what is not drawn, what is inert", () => {
		const host = page(`
			<div id="banner"><button>다시 적용</button></div>
			<input id="hidden-kind" type="hidden" />
			<input id="part-input" type="checkbox" tabindex="-1" aria-hidden="true" />
			<button id="off" disabled>꺼짐</button>
			<button id="busy" aria-disabled="true">일하는 중</button>
			<button id="gone" style="display: none">없음</button>
			<button id="unseen" style="visibility: hidden">안 보임</button>
			<div inert><button id="inert">잠든 것</button></div>
			<div tabindex="-1" id="box">상자</div>
			<input id="field" aria-label="이름" />`);
		const banner = host.querySelector("#banner") as Element;
		expect(nextStop(banner)?.id).toBe("field");
		// And the page's first stop is the banner's own action while the banner is there.
		expect(firstStop()).toBe(banner.querySelector("button"));
	});
});

describe("the hand-off's rare cases (T159)", () => {
	const made: (() => void)[] = [];
	afterEach(() => {
		for (const undo of made.splice(0)) undo();
	});
	const page = (html: string) => {
		const host = document.createElement("div");
		host.innerHTML = html;
		document.body.append(host);
		made.push(() => host.remove());
		return host;
	};
	const focusedId = () => document.activeElement?.id ?? "";

	it("a toast's button is not the page's first control, nor the next one after a banner: the toasts stand over the page, not in it", () => {
		const host = page(`
			<section aria-label="Notifications"><ol data-sonner-toaster><li><button id="undo">되돌리기</button></li></ol></section>
			<div id="banner"><span>문장</span></div>
			<section><ol data-sonner-toaster><li><button id="view">보기</button></li></ol></section>
			<button id="first">첫 컨트롤</button>`);
		expect(firstStop()?.id).toBe("first");
		expect(nextStop(host.querySelector("#banner") as Element)?.id).toBe("first");
	});

	it("a first control drawn off and switched on later takes the focus that waits for it: an attribute alone makes it a stop", async () => {
		// A view that took the editor's place, with its one control off until its read is in.
		const host = page(`<button id="pill" disabled>복원</button>`);
		(document.activeElement as HTMLElement | null)?.blur();
		// No body, no title: the focus is for the view's first control, once it has one.
		focusText(() => null, "no-title-here");
		await new Promise((frames) => requestAnimationFrame(() => requestAnimationFrame(frames)));
		expect(focusedId()).toBe("");
		host.querySelector("#pill")?.removeAttribute("disabled");
		await expect.poll(focusedId).toBe("pill");
	});

	it("a control the keyboard holds is still remembered after a pointer's press that moved no focus: pressed by key, its focus is handed on", async () => {
		function Banner() {
			const [offered, setOffered] = useState(true);
			const banner = useFocusHandOff(() => document.getElementById("after"));
			return (
				<>
					<button type="button" id="before">
						앞
					</button>
					<div ref={banner}>
						{offered ? (
							<button type="button" id="again" onClick={() => setOffered(false)}>
								다시 적용
							</button>
						) : null}
						{/* A tool that keeps the caret where it is: its press takes no focus. */}
						<button type="button" id="tool" tabIndex={-1} onMouseDown={(event) => event.preventDefault()}>
							도구
						</button>
					</div>
					<button type="button" id="after">
						첫 컨트롤
					</button>
				</>
			);
		}
		// Drawn as the stories are (the renderer the screen tests already load).
		await composeStory({ render: () => <Banner /> }, { title: "Tests/FocusHandOff" }).run();
		await expect.poll(() => document.getElementById("before")).not.toBeNull();
		// The keyboard comes to the banner's button.
		document.getElementById("before")?.focus();
		await userEvent.keyboard("{Tab}");
		expect(focusedId()).toBe("again");
		// A pointer's press elsewhere in the banner that moves no focus: the button still has the keyboard's.
		await userEvent.click(document.getElementById("tool") as HTMLElement);
		expect(focusedId()).toBe("again");
		// Pressed by key, the button goes and the banner stays: the focus goes on, not to the page.
		await userEvent.keyboard("{Enter}");
		await expect.poll(() => document.getElementById("again")).toBeNull();
		await expect.poll(focusedId).toBe("after");
	});

	it("a pointer's user who presses only Shift has not taken the keyboard up: when the button they clicked goes, nothing is moved", async () => {
		function Banner() {
			const [offered, setOffered] = useState(true);
			const banner = useFocusHandOff(() => document.getElementById("after"));
			return (
				<>
					<div ref={banner}>
						{offered ? (
							// It goes a moment after its press, by itself: no key and no second press takes it away.
							<button type="button" id="later" onClick={() => setTimeout(() => setOffered(false), 300)}>
								나중에
							</button>
						) : null}
						<span>문장</span>
					</div>
					<button type="button" id="after">
						첫 컨트롤
					</button>
				</>
			);
		}
		await composeStory({ render: () => <Banner /> }, { title: "Tests/FocusHandOffPointer" }).run();
		await expect.poll(() => document.getElementById("later")).not.toBeNull();
		await userEvent.click(document.getElementById("later") as HTMLElement);
		expect(focusedId()).toBe("later");
		await userEvent.keyboard("{Shift}");
		await expect.poll(() => document.getElementById("later")).toBeNull();
		await new Promise((done) => setTimeout(done, 200));
		expect(focusedId()).not.toBe("after");
	});
});
