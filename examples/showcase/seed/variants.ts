// The seed's variant entries: each block and mark used in its different ways, with a heading over each example that says what it
// shows, so a person can find it in the editor and on the site. One entry per component family.
import type { Inline, Mark } from "@monti-cms/core";
import {
	aligned,
	bold,
	bullets,
	checklist,
	code,
	codeWithTools,
	divider,
	doc,
	file,
	footnote,
	heading,
	image,
	italic,
	link,
	numbers,
	p,
	quote,
	ref,
	strike,
	sub,
	sup,
	t,
	table,
	underline,
} from "./body";

/** A heading that names the example under it, and a line that says what to look at. */
const shows = (id: string, title: string, what: string) => [heading(`${id}-h`, 3, title), p(`${id}-w`, t(what))];

/** Text and lists: headings at each level, marks alone and together, every kind of link, lists, checklists, quotes. */
export function textBlocks(entryLink: string) {
	return doc(
		heading("tx-h2", 2, "제목 크기"),
		heading("tx-h3", 3, "셋째 크기 제목"),
		heading("tx-h4", 4, "넷째 크기 제목"),
		heading("tx-marks", 2, "글자 서식"),
		...shows("tx-one", "서식 하나씩", "굵게, 기울임, 밑줄, 취소선, 코드, 위첨자, 아래첨자를 하나씩."),
		p(
			"tx-one-p",
			...([bold, italic, underline, strike, code, sup, sub] as Mark[]).flatMap((mark, at) => [
				...(at ? [t(" · ")] : []),
				t(mark.type, mark),
			]),
		),
		...shows("tx-many", "서식 여럿을 함께", "한 글자에 서식 두셋을 겹쳐 건다."),
		p(
			"tx-many-p",
			t("굵은 기울임", bold, italic),
			t(", "),
			t("밑줄 친 굵게", bold, underline),
			t(", "),
			t("지운 코드", code, strike),
			t(", 링크 안의 "),
			t("굵은 글자", bold, link("https://example.com")),
			t("."),
		),
		heading("tx-links", 2, "링크"),
		...shows("tx-link", "링크의 종류", "바깥 사이트, 이 사이트의 다른 글, 글 안의 제목, 메일."),
		p(
			"tx-link-p",
			t("바깥: "),
			t("example.com", link("https://example.com")),
			t(" · 다른 글: "),
			t("항구를 걷는 영상", link(entryLink)),
			t(" · 이 글의 제목: "),
			t("목록으로", link("#목록")),
			t(" · 메일: "),
			t("hello@example.com", link("mailto:hello@example.com")),
		),
		heading("tx-align", 2, "맞춤과 줄 바꿈"),
		aligned("tx-center", "center", t("가운데 맞춘 문단")),
		aligned("tx-right", "right", t("오른쪽 맞춘 문단")),
		p("tx-break", t("한 문단 안에서"), { type: "hardBreak" }, t("줄을 바꾸고"), { type: "hardBreak" }, t("또 바꾼다.")),
		heading("tx-lists", 2, "목록"),
		...shows("tx-bul", "점 목록", "한 줄짜리와 서식이 든 긴 줄."),
		bullets("tx-bul-l", [
			[t("짧은 줄")],
			[t("서식이 든 줄: "), t("굵게", bold), t("와 "), t("링크", link("https://example.com"))],
			[t("아주 긴 줄은 다음 줄로 넘어가도 점 하나에 붙어 있다. ".repeat(3).trim())],
		]),
		...shows("tx-num", "번호 목록", "1부터 세는 목록과 7부터 세는 목록."),
		numbers("tx-num-1", [[t("첫째")], [t("둘째")], [t("셋째")]]),
		numbers("tx-num-7", [[t("일곱째")], [t("여덟째")]], 7),
		...shows("tx-check", "체크리스트", "모두 한 것, 일부만 한 것, 아무것도 안 한 것."),
		checklist("tx-check-all", [
			[[t("표 만들기")], true],
			[[t("사진 넣기")], true],
		]),
		checklist("tx-check-some", [
			[[t("초안 쓰기")], true],
			[[t("검토 받기")], false],
			[[t("발행하기")], false],
		]),
		checklist("tx-check-none", [
			[[t("아직 시작하지 않은 일")], false],
			[[t("그다음 일")], false],
		]),
		heading("tx-quotes", 2, "인용"),
		...shows("tx-q1", "한 문단 인용", "서식이 든 짧은 인용."),
		quote("tx-q1-q", p("tx-q1-p", t("길은 "), t("걷는 사람", bold), t("이 만든다."))),
		...shows("tx-q2", "여러 블록이 든 인용", "문단 둘, 목록, 코드가 한 인용 안에."),
		quote(
			"tx-q2-q",
			p("tx-q2-a", t("인용의 첫 문단.")),
			p("tx-q2-b", t("인용의 둘째 문단, "), t("기울임", italic), t("과 함께.")),
			bullets("tx-q2-l", [[t("인용 안의 목록")], [t("둘째 줄")]]),
			codeWithTools("tx-q2-c", "bash", "echo 인용 안의 코드"),
		),
		divider("tx-end"),
		p("tx-last", t("구분선 뒤의 마지막 문단.")),
	);
}

/** Tables and footnotes: header or not, few and many columns, set widths, long cells; one, many and long notes. */
export function tableBlocks() {
	const wide = Array.from({ length: 8 }, (_, at) => `열 ${at + 1}`);
	return doc(
		heading("tb-tables", 2, "표"),
		...shows("tb-head", "머리 줄이 있는 표", "첫 줄이 머리이고, 열 너비는 정하지 않았다."),
		table("tb-head-t", [
			["장소", "계절", "요금"],
			["항구", "겨울", "12,000원"],
			["숲", "여름", "8,000원"],
		]),
		...shows("tb-nohead", "머리 줄이 없는 표", "모든 줄이 같은 칸이다."),
		{
			id: "tb-nohead-t",
			type: "table",
			attrs: {
				header: false,
				rows: [
					["가", "나"],
					["다", "라"],
				],
			},
		},
		...shows("tb-widths", "열 너비를 정한 표", "첫 열 50%, 나머지 25%씩."),
		table(
			"tb-widths-t",
			[
				["이름", "수", "비고"],
				["긴 이름이 들어가는 칸", "3", "—"],
			],
			[50, 25, 25],
		),
		...shows("tb-wide", "열이 많은 표", "열 여덟 개: 좁은 화면에서는 옆으로 넘긴다."),
		table("tb-wide-t", [wide, wide.map((_, at) => String(at + 1))]),
		...shows("tb-long", "긴 글이 든 칸", "칸 안에서 줄이 넘어간다."),
		table("tb-long-t", [
			["항목", "설명"],
			["긴 설명", "이 칸에는 여러 줄로 넘어갈 만큼 긴 설명이 들어 있다. ".repeat(4).trim()],
		]),
		heading("tb-notes", 2, "각주"),
		...shows("tb-n", "각주 여럿", "한 각주를 두 번 가리키고, 긴 각주도 하나 있다."),
		p("tb-n1", t("첫 번째 주장"), ref("a"), t(", 두 번째 주장"), ref("b"), t(", 다시 첫 번째"), ref("a"), t(".")),
		p("tb-n2", t("세 번째 주장"), ref("c"), t("과 네 번째"), ref("d"), t(".")),
		footnote("tb-fa", "a", t("짧은 각주.")),
		footnote("tb-fb", "b", t("링크가 든 각주: "), t("example.com", link("https://example.com"))),
		footnote("tb-fc", "c", t("아주 긴 각주는 글 끝에서 여러 줄로 넘어간다. ".repeat(5).trim())),
		footnote("tb-fd", "d", t("굵게", bold), t("가 든 각주.")),
	);
}

/** Pictures and files: each width kind, each alignment, crops and turns, with and without a caption, decorative; files named or not. */
export function mediaBlocks(media: {
	forest: string;
	desert: string;
	night: string;
	harbor: string;
	pdf: string;
	csv: string;
}) {
	const pic = (id: string, attrs: Record<string, unknown>) => image(id, attrs);
	return doc(
		heading("md-widths", 2, "그림의 크기"),
		...shows("md-own", "제 크기", "너비를 정하지 않은 그림: 그림의 제 크기, 본문보다 크면 본문 폭."),
		pic("md-own-i", { media: media.harbor, alt: "새벽 항구" }),
		...shows("md-pct", "본문 폭의 비율", "25%, 50%, 100%."),
		pic("md-25", { media: media.forest, alt: "숲", widthPercent: 25, caption: "25%" }),
		pic("md-50", { media: media.forest, alt: "숲", widthPercent: 50, caption: "50%" }),
		pic("md-100", { media: media.forest, alt: "숲", widthPercent: 100, caption: "100%" }),
		...shows("md-px", "px 너비", "160px와 320px."),
		pic("md-160", { media: media.desert, alt: "사막", width: 160, caption: "160px" }),
		pic("md-320", { media: media.desert, alt: "사막", width: 320, caption: "320px" }),
		heading("md-align", 2, "맞춤"),
		...shows("md-al", "왼쪽, 가운데, 오른쪽", "같은 그림을 세 자리에."),
		pic("md-left", { media: media.night, alt: "밤", width: 200, align: "left", caption: "왼쪽" }),
		pic("md-center", { media: media.night, alt: "밤", width: 200, align: "center", caption: "가운데" }),
		pic("md-right", { media: media.night, alt: "밤", width: 200, align: "right", caption: "오른쪽" }),
		heading("md-crop", 2, "자르기와 돌리기"),
		...shows("md-c", "잘라 낸 그림", "가운데만, 위쪽 띠만."),
		pic("md-crop-mid", {
			media: media.harbor,
			alt: "가운데만",
			width: 300,
			crop: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
			caption: "가운데 절반",
		}),
		pic("md-crop-top", {
			media: media.harbor,
			alt: "위쪽 띠",
			widthPercent: 100,
			crop: { x: 0, y: 0, width: 1, height: 0.3 },
			caption: "위쪽 30%",
		}),
		...shows("md-r", "돌린 그림", "90도, 180도, 270도."),
		pic("md-r90", { media: media.desert, alt: "90도", width: 200, rotate: 90, caption: "90도" }),
		pic("md-r180", { media: media.desert, alt: "180도", width: 200, rotate: 180, caption: "180도" }),
		pic("md-r270", { media: media.desert, alt: "270도", width: 200, rotate: 270, caption: "270도" }),
		heading("md-cap", 2, "캡션과 대체 텍스트"),
		...shows("md-cp", "캡션 없는 그림과 꾸밈용 그림", "캡션이 없으면 그림만, 꾸밈용은 대체 텍스트가 비어 있다."),
		pic("md-nocap", { media: media.forest, alt: "캡션 없는 숲", width: 240 }),
		pic("md-deco", { media: media.night, decorative: true, width: 240 }),
		heading("md-files", 2, "파일"),
		...shows("md-f", "내려받을 파일", "이름을 붙인 PDF, 제 이름 그대로인 CSV."),
		file("md-pdf", media.pdf, "요금표 (PDF)"),
		file("md-csv", media.csv),
	);
}

/** Lines of a sample program, as many as asked: the long code of the examples. */
const longCode = (lines: number) =>
	Array.from({ length: lines }, (_, at) => `const value${at + 1} = compute(${at + 1}); // line ${at + 1}`).join("\n");

/** Code blocks, one: the head and the frame. File name or not, line numbers or not, languages in and out of the list, long code. */
export function codeBasics() {
	return doc(
		heading("cb-head", 2, "머리 줄"),
		...shows("cb-name", "파일 이름이 있는 코드", "머리 줄에 언어와 파일 이름."),
		codeWithTools("cb-name-c", "ts", 'export const name = "monti";', { title: "src/name.ts" }),
		...shows("cb-noname", "파일 이름이 없는 코드", "머리 줄에 언어만."),
		codeWithTools("cb-noname-c", "ts", 'export const name = "monti";'),
		heading("cb-numbers", 2, "줄 번호"),
		...shows("cb-num-on", "줄 번호 켬", "사이트에도 번호가 선다."),
		codeWithTools("cb-num-on-c", "js", "const a = 1;\nconst b = 2;\nconsole.log(a + b);", { lineNumbers: true }),
		...shows("cb-num-off", "줄 번호 끔", "사이트에는 번호가 없다."),
		codeWithTools("cb-num-off-c", "js", "const a = 1;\nconst b = 2;\nconsole.log(a + b);"),
		heading("cb-langs", 2, "언어"),
		...shows("cb-plain", "일반 텍스트", "언어를 고르지 않은 코드: 색이 없다."),
		{ id: "cb-plain-c", type: "codeBlock", content: [t("그냥 글자\n색 없이 그대로")] },
		...shows(
			"cb-unknown",
			"목록에 없는 언어",
			"사이트가 고르지 않은 언어(rust): 이름이 그대로 보이고 색 없이 그려진다.",
		),
		codeWithTools("cb-unknown-c", "rust", 'fn main() {\n    println!("hello");\n}'),
		...shows("cb-each", "사이트의 언어 하나씩", "ts, tsx, js, json, bash, css, html, python."),
		codeWithTools("cb-ts", "ts", 'type Season = "spring" | "summer";'),
		codeWithTools("cb-tsx", "tsx", "export const Tag = ({ name }: { name: string }) => <span>#{name}</span>;"),
		codeWithTools("cb-js", "js", "export default [1, 2, 3].map((n) => n * 2);"),
		codeWithTools("cb-json", "json", '{ "seasons": ["spring", "summer"] }'),
		codeWithTools("cb-bash", "bash", "createdb monti_showcase && pnpm db:setup"),
		codeWithTools("cb-css", "css", "figure[data-code] { margin: 0; }"),
		codeWithTools("cb-html", "html", '<p class="note">안녕하세요</p>'),
		codeWithTools("cb-py", "python", 'seasons = ["spring", "summer"]\nprint(len(seasons))'),
		heading("cb-size", 2, "길이"),
		...shows("cb-long", "긴 코드", "60줄: 사이트에서는 길게 이어진다."),
		codeWithTools("cb-long-c", "ts", longCode(60), { lineNumbers: true, title: "src/values.ts" }),
		...shows("cb-wide", "긴 줄", "줄 하나가 아주 길다: 옆으로 넘긴다."),
		codeWithTools("cb-wide-c", "ts", `const sentence = "${"아주 긴 줄이 이어진다 ".repeat(12).trim()}";`),
		...shows("cb-quote", "인용 안의 코드", "인용이 코드 블록을 담는다."),
		quote("cb-quote-q", p("cb-quote-p", t("설치는 이렇게 한다:")), codeWithTools("cb-quote-c", "bash", "pnpm install")),
	);
}

const diffSource = `function total(items) {
  let sum = 0;
  for (const item of items) sum += item.price;
  for (const item of items) sum += item.price * item.count;
  return sum;
}`;

/** Code blocks, two: line effects alone and together, folds open and closed, several, and one inside another. */
export function codeLines() {
	const effect = (name: string, start: number, end = start + 1, attrs?: Record<string, unknown>) => ({
		name,
		start,
		end,
		...(attrs ? { attrs } : {}),
	});
	const alone = (name: string, label: string, what: string) => [
		...shows(`cl-${name}`, label, what),
		codeWithTools(`cl-${name}-c`, "js", diffSource, { lineNumbers: true, lines: [effect(name, 2)] }),
	];
	return doc(
		heading("cl-alone", 2, "줄 효과 하나씩"),
		...alone("highlight", "강조", "셋째 줄의 바탕이 밝다."),
		...alone("focus", "포커스", "셋째 줄만 또렷하고 나머지는 흐리다."),
		...alone("plus", "더한 줄", "셋째 줄 앞에 +."),
		...alone("minus", "뺀 줄", "셋째 줄 앞에 −."),
		...alone("warning", "경고", "셋째 줄에 노란 물결 밑줄."),
		...alone("error", "오류", "셋째 줄에 빨간 물결 밑줄."),
		heading("cl-together", 2, "줄 효과를 함께"),
		...shows("cl-diff", "바뀐 곳 보이기", "뺀 줄과 더한 줄이 나란히, 그 위 줄은 강조."),
		codeWithTools("cl-diff-c", "js", diffSource, {
			lineNumbers: true,
			lines: [effect("highlight", 1), effect("minus", 2), effect("plus", 3)],
		}),
		...shows("cl-stack", "한 줄에 효과 둘", "넷째 줄이 더한 줄이면서 경고다."),
		codeWithTools("cl-stack-c", "js", diffSource, {
			lineNumbers: true,
			lines: [effect("plus", 3), effect("warning", 3)],
		}),
		...shows("cl-range", "여러 줄에 걸친 효과", "둘째에서 넷째 줄까지 강조, 다섯째 줄은 오류."),
		codeWithTools("cl-range-c", "js", diffSource, {
			lineNumbers: true,
			lines: [effect("highlight", 1, 4), effect("error", 4)],
		}),
		heading("cl-folds", 2, "줄 접기"),
		...shows("cl-closed", "닫힌 접기", "함수 몸통이 첫 줄로 접혀 있고, 누르면 펴진다."),
		codeWithTools("cl-closed-c", "js", diffSource, { lineNumbers: true, lines: [effect("collapse", 0, 5)] }),
		...shows("cl-open", "처음부터 펼친 접기", "펼친 채로 시작하고, 누르면 접힌다."),
		codeWithTools("cl-open-c", "js", diffSource, {
			lineNumbers: true,
			lines: [effect("collapse", 0, 5, { open: true })],
		}),
		...shows("cl-many", "접기 여럿", "두 함수가 따로 접힌다."),
		codeWithTools("cl-many-c", "js", "function a() {\n  return 1;\n}\nfunction b() {\n  return 2;\n}", {
			lineNumbers: true,
			lines: [effect("collapse", 0, 2), effect("collapse", 3, 5)],
		}),
		...shows("cl-nested", "접기 안의 접기", "바깥 함수 안에 안쪽 블록이 또 접혀 있다."),
		codeWithTools(
			"cl-nested-c",
			"js",
			"function outer() {\n  if (ready) {\n    start();\n    finish();\n  }\n  return done;\n}",
			{
				lineNumbers: true,
				lines: [effect("collapse", 0, 6, { open: true }), effect("collapse", 1, 4)],
			},
		),
		...shows("cl-fold-effects", "접힌 곳 안의 효과", "접힌 줄 안에 더한 줄과 뺀 줄이 있다."),
		codeWithTools("cl-fold-effects-c", "js", diffSource, {
			lineNumbers: true,
			lines: [effect("collapse", 0, 5), effect("minus", 2), effect("plus", 3)],
		}),
	);
}

/** Code blocks, three: text effects by rule (each kind, the whole code and one line), marks in code, folds over words, tooltips, links. */
export function codeText() {
	const source = 'const user = getUser("someone@example.com");\nconst count = user.posts.length;\nlog(count);';
	const rule = (name: string, pattern: string, extra: Record<string, unknown> = {}) => ({
		scope: "document",
		name,
		pattern,
		flags: "g",
		...extra,
	});
	const ruleExample = (id: string, label: string, what: string, rules: unknown[]) => [
		...shows(id, label, what),
		codeWithTools(`${id}-c`, "ts", source, { lineNumbers: true, rules }),
	];
	const toLines: Inline[] = [
		t("코드 링크 둘: "),
		t("첫 코드의 둘째 줄", { type: "codeRef", block: "ct-two-a", anchor: "a1" }),
		t("과 "),
		t("둘째 코드의 셋째 줄", { type: "codeRef", block: "ct-two-b", anchor: "b1" }),
		t(". 여러 줄을 가리키는 링크: "),
		t("첫 코드 전체", { type: "codeRef", block: "ct-two-a", anchor: "a2" }),
		t("."),
	];
	return doc(
		heading("ct-rules", 2, "정규식 규칙"),
		...ruleExample("ct-bold", "굵게 규칙 (코드 전체)", "모든 count가 굵다.", [rule("bold", "\\bcount\\b")]),
		...ruleExample("ct-italic", "기울임 규칙", "모든 user가 기울어진다.", [rule("italic", "\\buser\\b")]),
		...ruleExample("ct-under", "밑줄 규칙", "함수 이름에 밑줄.", [rule("underline", "\\b(getUser|log)\\b")]),
		...ruleExample("ct-strike", "취소선 규칙", "length에 취소선.", [rule("strike", "length")]),
		...ruleExample("ct-tip", "툴팁 규칙", "getUser를 가리키면 설명이 뜬다.", [
			rule("codeTip", "getUser", { attrs: { text: "사용자를 이메일로 찾는다" } }),
		]),
		...ruleExample("ct-fold", "접기 규칙", "메일 주소가 …로 접히고, 누르면 펴진다.", [
			rule("codeFold", '"[^"\\n]+@[^"\\n]+"'),
		]),
		...ruleExample("ct-line", "한 줄 규칙", "둘째 줄의 count만 굵다.", [
			{ scope: "line", line: 1, name: "bold", pattern: "count", flags: "g" },
		]),
		...ruleExample("ct-all", "규칙 여럿", "굵게, 툴팁, 접기를 한 코드에.", [
			rule("bold", "\\bcount\\b"),
			rule("codeTip", "getUser", { attrs: { text: "사용자를 찾는다" } }),
			rule("codeFold", '"[^"\\n]+@[^"\\n]+"', { attrs: { open: true } }),
		]),
		heading("ct-marks", 2, "코드 안의 서식"),
		...shows("ct-m", "손으로 건 서식", "굵게, 기울임, 밑줄, 취소선을 글자에 직접."),
		codeWithTools("ct-m-c", "ts", source, {}, [
			{ words: "getUser", mark: bold },
			{ words: "someone@example.com", mark: italic },
			{ words: "posts", mark: underline },
			{ words: "length", mark: strike },
		]),
		...shows("ct-tipmark", "코드 안의 툴팁", "글자에 직접 건 툴팁 둘."),
		codeWithTools("ct-tipmark-c", "ts", source, {}, [
			{ words: "getUser", mark: { type: "codeTip", text: "서버에서 사용자를 읽는다" } },
			{ words: "log", mark: { type: "codeTip", text: "콘솔에 남긴다" } },
		]),
		...shows("ct-foldmark", "글자 접기", "접힌 글자와 처음부터 펼친 글자."),
		codeWithTools("ct-foldmark-c", "ts", source, {}, [
			{ words: '"someone@example.com"', mark: { type: "codeFold" } },
			{ words: "user.posts.length", mark: { type: "codeFold", open: true } },
		]),
		heading("ct-links", 2, "코드 링크"),
		...shows("ct-two", "코드 둘을 가리키는 링크", "본문 글자가 두 코드 블록의 줄을 하나씩, 그리고 여러 줄을 가리킨다."),
		p("ct-two-p", ...toLines),
		codeWithTools("ct-two-a", "ts", source, {
			title: "first.ts",
			lineNumbers: true,
			lines: [
				{ name: "anchor", start: 1, end: 2, attrs: { id: "a1" } },
				{ name: "anchor", start: 0, end: 3, attrs: { id: "a2" } },
			],
		}),
		codeWithTools("ct-two-b", "js", diffSource, {
			title: "second.js",
			lineNumbers: true,
			lines: [
				{ name: "collapse", start: 0, end: 5 },
				{ name: "anchor", start: 2, end: 3, attrs: { id: "b1" } },
			],
		}),
	);
}
