import { afterEach, describe, expect, it } from "vitest";
import { firstStop, nextStop } from "./focus-hand-off";

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
