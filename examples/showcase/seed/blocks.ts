// The seed's entries for the blocks `monti add` copied in (doc 18): each block used in its different ways, a heading over each example
// saying what it shows. The blocks live in `monti/blocks`; their values are the shapes their `index.ts` defines.
import type { Inline, Mark, NewBlock } from "@monti-cms/core";
import { bold, bullets, codeWithTools, doc, heading, image, italic, link, numbers, p, t, table } from "./body";

const shows = (id: string, title: string, what: string) => [heading(`${id}-h`, 3, title), p(`${id}-w`, t(what))];
const block = (id: string, type: string, attrs: Record<string, unknown>, children?: NewBlock[]): NewBlock => ({
	id,
	type,
	attrs,
	...(children ? { children } : {}),
});

const TONES = ["note", "tip", "info", "warning", "danger"] as const;
const TONE_WORDS = { note: "메모", tip: "팁", info: "정보", warning: "주의", danger: "위험" } as const;

/** Callouts and collapsibles: every kind with and without a title, blocks inside, open and closed, one inside the other. */
export function calloutsAndCollapsibles(picture?: string) {
	return doc(
		heading("co", 2, "콜아웃"),
		...shows("co-plain", "제목 없는 콜아웃, 종류마다", "제목이 없으면 종류의 이름이 제목이다."),
		...TONES.map((tone) =>
			block(`co-plain-${tone}`, "callout", { tone }, [
				p(`co-plain-${tone}-p`, t(`${TONE_WORDS[tone]} 콜아웃의 본문.`)),
			]),
		),
		...shows("co-titled", "제목을 붙인 콜아웃, 종류마다", "같은 다섯 종류에 제목을 붙였다."),
		...TONES.map((tone) =>
			block(`co-titled-${tone}`, "callout", { tone, title: `${TONE_WORDS[tone]}: 제목을 단 콜아웃` }, [
				p(`co-titled-${tone}-p`, t("제목 아래의 본문.")),
			]),
		),
		...shows("co-blocks", "여러 블록이 든 콜아웃", "문단, 목록, 코드, 표가 한 콜아웃 안에."),
		block("co-blocks-c", "callout", { tone: "tip", title: "설치 순서" }, [
			p("co-blocks-p", t("이렇게 "), t("세 단계", bold), t("로 한다.")),
			numbers("co-blocks-l", [[t("데이터베이스 만들기")], [t("표 만들기")], [t("씨앗 넣기")]]),
			codeWithTools("co-blocks-code", "bash", "createdb monti_showcase\npnpm db:setup\npnpm seed"),
			table("co-blocks-t", [
				["명령", "하는 일"],
				["db:setup", "표를 만든다"],
			]),
		]),
		...(picture
			? [
					...shows("co-pic", "그림이 든 콜아웃", "콜아웃 안의 그림."),
					block("co-pic-c", "callout", { tone: "info" }, [
						image("co-pic-i", { media: picture, alt: "숲", widthPercent: 60, caption: "콜아웃 안의 그림" }),
					]),
				]
			: []),
		heading("cl", 2, "접기"),
		...shows("cl-closed", "처음에 닫힌 접기", "제목을 누르면 열린다."),
		block("cl-closed-c", "collapsible", { title: "자주 묻는 질문: 비밀번호를 잊었어요" }, [
			p("cl-closed-p", t("명령으로 새 비밀번호를 정한다.")),
		]),
		...shows("cl-open", "처음에 열린 접기", "열린 채로 시작하고, 누르면 닫힌다."),
		block("cl-open-c", "collapsible", { title: "열린 채로 시작", defaultOpen: true }, [
			p("cl-open-p", t("처음부터 보이는 본문.")),
		]),
		...shows("cl-notitle", "제목 없는 접기", "제목을 비우면 기본 이름이 선다."),
		block("cl-notitle-c", "collapsible", {}, [p("cl-notitle-p", t("제목 없이 접힌 본문."))]),
		...shows("cl-long", "긴 내용을 담은 접기", "긴 기록과 코드를 접어 둔다."),
		block("cl-long-c", "collapsible", { title: "실행 기록 전체" }, [
			codeWithTools(
				"cl-long-code",
				"bash",
				Array.from({ length: 30 }, (_, at) => `[${String(at).padStart(2, "0")}:00] step ${at + 1} done`).join("\n"),
				{ lineNumbers: true },
			),
		]),
		...shows("cl-nest", "접기 안의 콜아웃, 콜아웃 안의 접기", "서로를 품는다."),
		block("cl-nest-c", "collapsible", { title: "안에 콜아웃이 있다", defaultOpen: true }, [
			block("cl-nest-callout", "callout", { tone: "warning", title: "안쪽 콜아웃" }, [
				block("cl-nest-inner", "collapsible", { title: "콜아웃 안의 접기" }, [p("cl-nest-p", t("가장 안쪽 본문."))]),
			]),
		]),
	);
}

const tab = (id: string, label: string, ...children: NewBlock[]) => block(id, "tab", { label }, children);
const column = (id: string, ...children: NewBlock[]) => block(id, "column", {}, children);

/** Tabs and columns: two to eight tabs with different content and a first tab set; two to four columns, equal and set widths. */
export function tabsAndColumns(picture?: string) {
	const tabsOf = (id: string, count: number, first?: string) =>
		block(
			id,
			"tabs",
			first ? { defaultValue: first } : {},
			Array.from({ length: count }, (_, at) =>
				tab(`${id}-${at}`, `탭 ${at + 1}`, p(`${id}-${at}-p`, t(`${at + 1}번째 탭의 본문.`))),
			),
		);
	return doc(
		heading("tb", 2, "탭"),
		...shows("tb-2", "탭 둘", "가장 적은 탭."),
		tabsOf("tb-2-t", 2),
		...shows("tb-3", "탭 셋, 다른 내용", "설치 명령을 도구마다: 코드, 목록, 표."),
		block("tb-3-t", "tabs", {}, [
			tab("tb-3-pnpm", "pnpm", codeWithTools("tb-3-pnpm-c", "bash", "pnpm add @monti-cms/core")),
			tab("tb-3-npm", "npm", bullets("tb-3-npm-l", [[t("npm을 쓰면")], [t("명령이 조금 다르다")]])),
			tab(
				"tb-3-yarn",
				"yarn",
				table("tb-3-yarn-t", [
					["도구", "명령"],
					["yarn", "yarn add @monti-cms/core"],
				]),
			),
		]),
		...shows("tb-first", "처음 보이는 탭을 정한 탭", "다섯 탭 가운데 셋째가 처음 열린다."),
		tabsOf("tb-first-t", 5, "탭 3"),
		...shows("tb-8", "탭 여덟", "가장 많은 탭: 이름 줄이 넘친다."),
		tabsOf("tb-8-t", 8),
		...(picture
			? [
					...shows("tb-pic", "그림이 든 탭", "탭마다 다른 크기의 그림."),
					block("tb-pic-t", "tabs", {}, [
						tab("tb-pic-a", "작게", image("tb-pic-a-i", { media: picture, alt: "작게", width: 160 })),
						tab("tb-pic-b", "크게", image("tb-pic-b-i", { media: picture, alt: "크게", widthPercent: 100 })),
					]),
				]
			: []),
		heading("cm", 2, "단 나누기"),
		...shows("cm-2", "두 단, 같은 너비", "너비를 정하지 않으면 똑같이 나눈다."),
		block("cm-2-c", "columns", {}, [
			column("cm-2-a", p("cm-2-a-p", t("왼쪽 단의 문단."))),
			column("cm-2-b", p("cm-2-b-p", t("오른쪽 단의 문단."))),
		]),
		...shows("cm-2w", "두 단, 70:30", "넓은 본문 옆에 좁은 곁들이."),
		block("cm-2w-c", "columns", { widths: "70,30" }, [
			column("cm-2w-a", p("cm-2w-a-p", t("넓은 단에는 긴 글이 들어간다. ".repeat(4).trim()))),
			column("cm-2w-b", block("cm-2w-b-c", "callout", { tone: "tip" }, [p("cm-2w-b-p", t("좁은 단의 팁."))])),
		]),
		...shows("cm-3", "세 단, 50:25:25", "코드, 목록, 표를 나란히."),
		block("cm-3-c", "columns", { widths: "50,25,25" }, [
			column("cm-3-a", codeWithTools("cm-3-a-c", "ts", "export const columns = 3;")),
			column("cm-3-b", bullets("cm-3-b-l", [[t("하나")], [t("둘")]])),
			column(
				"cm-3-c-col",
				table("cm-3-c-t", [
					["가", "나"],
					["1", "2"],
				]),
			),
		]),
		...shows("cm-4", "네 단", "가장 많은 단: 좁은 화면에서는 위아래로 쌓인다."),
		block(
			"cm-4-c",
			"columns",
			{},
			["봄", "여름", "가을", "겨울"].map((season, at) =>
				column(`cm-4-${at}`, heading(`cm-4-${at}-h`, 4, season), p(`cm-4-${at}-p`, t(`${season}의 이야기.`))),
			),
		),
		...(picture
			? [
					...shows("cm-pic", "그림과 글을 나란히", "그림 단과 글 단."),
					block("cm-pic-c", "columns", { widths: "40,60" }, [
						column("cm-pic-a", image("cm-pic-a-i", { media: picture, alt: "숲", widthPercent: 100 })),
						column("cm-pic-b", p("cm-pic-b-p", t("그림 옆의 설명은 그림의 높이만큼 이어진다."))),
					]),
				]
			: []),
		...shows("cm-tabs", "단 안의 탭", "한 단에 탭, 다른 단에 접기."),
		block("cm-tabs-c", "columns", {}, [
			column("cm-tabs-a", tabsOf("cm-tabs-a-t", 2)),
			column(
				"cm-tabs-b",
				block("cm-tabs-b-c", "collapsible", { title: "단 안의 접기" }, [p("cm-tabs-b-p", t("접힌 본문."))]),
			),
		]),
	);
}

const math = (id: string, source: string) => block(id, "math", { source });
const mermaid = (id: string, source: string) => block(id, "mermaid", { source });
const chart = (id: string, ...lines: string[]) => block(id, "chart", { source: lines.join("\n") });

/** Formulas, diagrams and charts: short and long formulas, each diagram kind, each chart kind, and one of each that does not read. */
export function formulasDiagramsCharts() {
	return doc(
		heading("mt", 2, "수식"),
		...shows("mt-short", "짧은 수식", "한 줄짜리."),
		math("mt-short-m", "E = mc^2"),
		...shows("mt-frac", "분수와 근호", "근의 공식."),
		math("mt-frac-m", "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}"),
		...shows("mt-sum", "합과 적분", "기호가 위아래로 붙는다."),
		math("mt-sum-m", "\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}, \\quad \\int_0^1 x^2 \\, dx = \\frac{1}{3}"),
		...shows("mt-matrix", "행렬", "괄호 안의 행렬."),
		math("mt-matrix-m", "A = \\begin{pmatrix} 1 & 2 & 3 \\\\ 4 & 5 & 6 \\\\ 7 & 8 & 9 \\end{pmatrix}"),
		...shows("mt-long", "긴 수식", "여러 줄로 맞춘 식: 좁은 화면에서는 옆으로 넘긴다."),
		math(
			"mt-long-m",
			"\\begin{aligned} (a+b)^3 &= (a+b)(a+b)^2 \\\\ &= (a+b)(a^2 + 2ab + b^2) \\\\ &= a^3 + 3a^2b + 3ab^2 + b^3 \\end{aligned}",
		),
		...shows("mt-bad", "읽히지 않는 수식", "괄호가 닫히지 않았다: 편집기에 까닭이 보인다."),
		math("mt-bad-m", "\\frac{1}{2"),
		heading("mm", 2, "다이어그램"),
		...shows("mm-flow", "흐름도", "글을 쓰고 발행하기까지."),
		mermaid("mm-flow-m", "flowchart LR\n  A[초안] --> B{검토}\n  B -- 통과 --> C[발행]\n  B -- 고칠 것 --> A"),
		...shows("mm-seq", "순서도", "편집기와 서버가 주고받는 것."),
		mermaid(
			"mm-seq-m",
			"sequenceDiagram\n  participant 편집기\n  participant 서버\n  편집기->>서버: 저장\n  서버-->>편집기: 새 버전\n  편집기->>서버: 발행",
		),
		...shows("mm-state", "상태도", "글의 상태."),
		mermaid(
			"mm-state-m",
			"stateDiagram-v2\n  [*] --> 초안\n  초안 --> 발행됨: 발행\n  발행됨 --> 수정중: 저장\n  수정중 --> 발행됨: 발행\n  발행됨 --> 보관됨: 보관",
		),
		...shows("mm-er", "관계도", "글과 태그와 사람."),
		mermaid(
			"mm-er-m",
			"erDiagram\n  ARTICLE }o--o{ TAG : has\n  ARTICLE }o--o{ PERSON : written_by\n  ARTICLE }o--|| SERIES : in",
		),
		...shows("mm-class", "클래스도", "블록과 서식."),
		mermaid(
			"mm-class-m",
			"classDiagram\n  class Block {\n    id\n    type\n  }\n  class Mark {\n    type\n  }\n  Block --> Mark : content",
		),
		...shows("mm-gantt", "일정표", "출시까지의 일."),
		mermaid(
			"mm-gantt-m",
			"gantt\n  dateFormat YYYY-MM-DD\n  section 만들기\n  설계 :a1, 2026-11-01, 5d\n  구현 :after a1, 7d\n  section 확인\n  QA :2026-11-13, 2d",
		),
		...shows("mm-pie", "원 그래프", "Mermaid의 원 그래프."),
		mermaid("mm-pie-m", 'pie title 글의 상태\n  "발행됨" : 6\n  "초안" : 4\n  "보관됨" : 1'),
		...shows("mm-mind", "마인드맵", "기능의 갈래."),
		mermaid("mm-mind-m", "mindmap\n  root((Monti))\n    글\n      초안\n      발행\n    미디어\n    번역"),
		...shows("mm-bad", "읽히지 않는 다이어그램", "모르는 말로 시작한다: 편집기와 사이트에 까닭이 보인다."),
		mermaid("mm-bad-m", "flowchart LR\n  A --> \n  ((("),
		heading("ch", 2, "차트"),
		...shows("ch-bar", "막대", "계열 하나."),
		chart(
			"ch-bar-c",
			"chart bar",
			"x month",
			"series views | 조회 | chart-1",
			"",
			"data",
			"month | views",
			"1월 | 1200",
			"2월 | 1850",
			"3월 | 2400",
		),
		...shows("ch-bars", "막대 여럿과 값 표시", "계열 둘, 막대 위에 값."),
		chart(
			"ch-bars-c",
			"chart bar",
			"x month",
			"series views | 조회 | chart-1",
			"series likes | 좋아요 | chart-2",
			"show-values",
			"",
			"data",
			"month | views | likes",
			"1월 | 1200 | 80",
			"2월 | 1850 | 140",
			"3월 | 2400 | 210",
		),
		...shows("ch-line", "선", "계열 셋, 격자 없이."),
		chart(
			"ch-line-c",
			"chart line",
			"x week",
			"series a | 서울 | chart-1",
			"series b | 부산 | chart-3",
			"series c | 제주 | chart-5",
			"hide-grid",
			"",
			"data",
			"week | a | b | c",
			"1주 | 10 | 8 | 3",
			"2주 | 14 | 9 | 6",
			"3주 | 12 | 13 | 9",
			"4주 | 18 | 15 | 12",
		),
		...shows("ch-area", "영역", "세로축 범위를 정하고 세로축을 숨겼다."),
		chart(
			"ch-area-c",
			"chart area",
			"x day",
			"series temp | 기온 | chart-4",
			"y-range 0 30",
			"hide-y-axis",
			"",
			"data",
			"day | temp",
			"월 | 12",
			"화 | 15",
			"수 | 21",
			"목 | 18",
			"금 | 24",
		),
		...shows("ch-pie", "원", "계절마다 글 수."),
		chart(
			"ch-pie-c",
			"chart pie",
			"label season",
			"value count",
			"",
			"data",
			"season | count",
			"봄 | 5",
			"여름 | 8",
			"가을 | 3",
			"겨울 | 2",
		),
		...shows("ch-bad", "읽히지 않는 차트", "모르는 종류: 편집기와 사이트에 까닭이 보인다."),
		chart("ch-bad-c", "chart radar", "x month", "", "data", "month | views", "1월 | 열둘"),
	);
}

/** Code explorers and the marks: a flat one, one with folders and a first file, a code link into a file not shown; colours and tooltips. */
export function explorersAndMarks() {
	const file = (id: string, path: string, source: string, attrs: Record<string, unknown> = {}) =>
		codeWithTools(id, path.split(".").pop() ?? "ts", source, { title: path, ...attrs });
	const folder = (id: string, path: string): NewBlock => ({ id, type: "codeBlock", attrs: { title: path } });
	const toHidden: Inline[] = [
		t("코드 탐색기 안의 숨은 파일로 가는 링크: "),
		t("utils/format.ts의 둘째 줄", { type: "codeRef", block: "ex-tree-format", anchor: "f1" }),
		t(". 누르면 그 파일이 열리고 줄이 밝아진다."),
	];
	const colors = ["gray", "red", "orange", "yellow", "green", "blue", "purple", "pink"] as const;
	const colorMark = (attrs: Record<string, string>): Mark => ({ type: "color", ...attrs });
	return doc(
		heading("ex", 2, "코드 탐색기"),
		...shows("ex-flat", "파일 둘", "폴더 없이 나란한 파일."),
		block("ex-flat-e", "codeExplorer", {}, [
			file("ex-flat-a", "index.ts", 'export { greet } from "./greet";'),
			// biome-ignore lint/suspicious/noTemplateCurlyInString: the sample code's own template string
			file("ex-flat-b", "greet.ts", "export const greet = (name: string) => `hello ${name}`;"),
		]),
		...shows("ex-tree", "폴더와 처음 여는 파일", "폴더 셋, 처음에는 src/app.tsx가 열린다."),
		block("ex-tree-e", "codeExplorer", { open: "src/app.tsx" }, [
			folder("ex-tree-src", "src/"),
			file(
				"ex-tree-app",
				"src/app.tsx",
				'import { format } from "./utils/format";\n\nexport const App = () => <p>{format(3)}</p>;',
				{
					lineNumbers: true,
				},
			),
			folder("ex-tree-utils", "src/utils/"),
			file(
				"ex-tree-format",
				"src/utils/format.ts",
				// biome-ignore lint/suspicious/noTemplateCurlyInString: the sample code's own template string
				"export function format(count: number) {\n  return `${count}편`;\n}",
				{
					lineNumbers: true,
					lines: [{ name: "anchor", start: 1, end: 2, attrs: { id: "f1" } }],
				},
			),
			file("ex-tree-css", "src/styles/app.css", ".app {\n  padding: 16px;\n}"),
			file("ex-tree-json", "package.json", '{\n  "name": "explorer-example"\n}'),
		]),
		...shows("ex-link", "숨은 파일로 가는 코드 링크", "처음 열린 파일이 아닌 파일의 줄을 가리킨다."),
		p("ex-link-p", ...toHidden),
		...shows("ex-effects", "줄 효과가 있는 파일", "탐색기 안의 파일에도 뺀 줄과 더한 줄."),
		block("ex-effects-e", "codeExplorer", {}, [
			file("ex-effects-a", "diff.js", "const a = 1;\nconst b = 2;\nconst c = 3;", {
				lineNumbers: true,
				lines: [
					{ name: "minus", start: 1, end: 2 },
					{ name: "plus", start: 2, end: 3 },
				],
			}),
		]),
		heading("mk", 2, "글자 색과 툴팁"),
		...shows("mk-color", "글자 색, 여덟 가지", "회색부터 분홍까지."),
		p("mk-color-p", ...colors.flatMap((color, at) => [...(at ? [t(" ")] : []), t(color, colorMark({ color }))])),
		...shows("mk-bg", "바탕 색, 여덟 가지", "글자 뒤의 색."),
		p(
			"mk-bg-p",
			...colors.flatMap((color, at) => [...(at ? [t(" ")] : []), t(color, colorMark({ background: color }))]),
		),
		...shows("mk-both", "글자 색과 바탕 색을 함께", "빨간 글자에 노란 바탕, 굵게와 함께."),
		p(
			"mk-both-p",
			t("빨간 글자에 노란 바탕", colorMark({ color: "red", background: "yellow" })),
			t(", "),
			t("굵은 파란 글자", bold, colorMark({ color: "blue" })),
			t(", "),
			t("기울인 초록 바탕", italic, colorMark({ background: "green" })),
		),
		...shows("mk-tip", "툴팁", "글자를 가리키면 설명이 뜬다."),
		p(
			"mk-tip-p",
			t("Monti는 "),
			t("CMS", { type: "tooltip", text: "콘텐츠 관리 시스템" }),
			t("다. "),
			t("SEO", { type: "tooltip", text: "검색 엔진 최적화: 검색 결과에 잘 보이게 하는 일" }),
			t(" 플러그인이 있다."),
		),
		...shows("mk-tip-more", "툴팁과 다른 서식", "색, 굵게, 링크와 함께 건 툴팁."),
		p(
			"mk-tip-more-p",
			t("색과 툴팁", colorMark({ color: "purple" }), { type: "tooltip", text: "보라 글자에 단 설명" }),
			t(", "),
			t("굵게와 툴팁", bold, { type: "tooltip", text: "굵은 글자에 단 설명" }),
			t(", "),
			t("링크와 툴팁", link("https://example.com"), { type: "tooltip", text: "example.com으로 간다" }),
		),
	);
}
