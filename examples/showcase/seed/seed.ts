// `pnpm seed`: fills a fresh database (after `pnpm db:setup`) with content that shows every feature. Everything goes through the core's
// operations (`monti.run`), as the admin and the CLI run them, so the seed takes the real paths: checks, relations, translations' marks,
// the activity log and the deliveries. The words are the sample site's (Korean, with English and Japanese translations).
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	acceptFile,
	type Block,
	type Doc,
	type Entry,
	entryLink,
	HEAD_BYTES,
	type Inline,
	type MontiConfig,
	openMonti,
} from "@monti-cms/core";
import { loadEnvFiles } from "@monti-cms/core/cli";
import { calloutsAndCollapsibles, explorersAndMarks, formulasDiagramsCharts, tabsAndColumns } from "./blocks";
import {
	aligned,
	bold,
	bullets,
	checklist,
	code,
	codeBlock,
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
import { codeBasics, codeLines, codeText, mediaBlocks, tableBlocks, textBlocks } from "./variants";

const root = fileURLToPath(new URL("..", import.meta.url));
// The env files the way `monti` and Next read them, before the config reads the environment.
loadEnvFiles(root, process.env, "development");
const config = ((await import("../monti.config")) as { default: MontiConfig }).default;

// Only the hook that fails on purpose: the dev server that answers `/hooks/ok` is not running while the seed is. Nothing answers
// `/hooks/broken` either, so the seeded deliveries fail as refused connections; sent again while `pnpm dev` runs, they fail with its 503.
const monti = openMonti(
	{ ...config, receivers: (config.receivers ?? []).filter((receiver) => receiver.destination === "webhook:broken") },
	root,
);
const as = { actor: "cli" } as const;

async function write<Output = { id: string }>(name: string, input: unknown): Promise<Output> {
	return ((await monti.run(name, input, as)) as { output: Output }).output;
}
const read = <Output>(name: string, input: unknown) => monti.run(name, input, as) as Promise<Output>;
const entryOf = async (id: string) => (await read<{ entry: Entry }>("entries.get", { id })).entry;
const groupOf = async (id: string) => (await entryOf(id)).translationGroup;

const counted = await monti.db
	.selectFrom("entries")
	.select((eb) => eb.fn.countAll<string>().as("count"))
	.executeTakeFirstOrThrow();
if (Number(counted.count) > 0) {
	console.error(
		"This database has entries already. The seed fills an empty one: make a new database, run `pnpm db:setup`, then this.",
	);
	process.exit(1);
}

// ── Admin values: the collections' and fields' names, the property panel's tabs and groups ──────────────────────────────────────────────

const labels = (fields: Record<string, string>) =>
	Object.fromEntries(Object.entries(fields).map(([field, label]) => [field, { label }]));

await write("collections.updateAdminValues", {
	collection: "article",
	values: {
		label: "글",
		folders: true,
		fields: {
			...labels({
				summary: "요약",
				subtitle: "부제",
				topic: "주제",
				seasons: "계절",
				cover: "표지",
				attachment: "첨부 파일",
				series: "연재",
				tags: "태그",
				authors: "글쓴이",
				related: "관련 글",
				videoUrl: "영상 주소",
				videoLength: "영상 길이",
				galleryLayout: "배치",
				galleryPoster: "대표 사진",
				linkKind: "링크 종류",
				linkUrl: "주소",
				linkTarget: "가리키는 글",
				pinNote: "고정 메모",
			}),
			summary: { label: "요약", description: "목록과 검색 결과에 보이는 한두 문장" },
			topic: { label: "주제", optionLabels: { guide: "안내", news: "소식", opinion: "생각" } },
			format: { label: "형식", optionLabels: { text: "글", video: "영상", gallery: "사진첩", link: "링크" } },
			pinned: { label: "맨 위에 고정" },
		},
		layout: [
			{
				tab: "기본",
				fields: [
					"title",
					"slug",
					"summary",
					"subtitle",
					{ group: "분류", fields: ["topic", "seasons", "series", "tags"] },
				],
			},
			{ tab: "미디어", fields: ["cover", "attachment"] },
			{ tab: "관계", fields: ["authors", "related"] },
			{ tab: "형식", fields: ["format", "pinned"] },
		],
	},
});
await write("collections.updateAdminValues", {
	collection: "tag",
	values: { label: "태그", fields: labels({ description: "설명" }) },
});
await write("collections.updateAdminValues", {
	collection: "person",
	values: { label: "사람", fields: labels({ bio: "소개", photo: "사진", roles: "역할", articles: "쓴 글" }) },
});
await write("collections.updateAdminValues", {
	collection: "series",
	values: { label: "연재", fields: labels({ note: "메모" }) },
});

// ── Media: folders, pictures and files ──────────────────────────────────────────────────────────────────────────────────────────────

const storage = monti.site.storage;
const folder = (name: string, parentId: string | null = null) =>
	write("folders.create", { scope: "media", parentId, name }).then((made) => made.id);

/** A PNG's size, from its header. */
function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
	if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** A file of `seed/files` into the library, the way the admin's byte route takes it: the same check, a key the server made. */
async function upload(source: string, name: string, folderId: string | null): Promise<string> {
	if (!storage) throw new Error("no storage");
	const bytes = new Uint8Array(readFileSync(path.join(root, "seed", "files", source)));
	const accepted = acceptFile({ name, size: bytes.length, head: bytes.subarray(0, HEAD_BYTES) });
	if (!accepted.ok) throw new Error(`${source} is refused: ${JSON.stringify(accepted.reason)}`);
	const key = `${randomUUID()}${accepted.extension}`;
	await storage.put(key, bytes, { mime: accepted.mime });
	const size = pngSize(bytes);
	const made = await write<{ id: string }>("media.upload", {
		name,
		folderId,
		original: { key, ...(size ?? {}) },
	});
	return made.id;
}

type Media = Record<"harbor" | "forest" | "desert" | "night" | "portrait" | "unused" | "pdf" | "csv", string>;
let media: Media | null = null;
if (storage) {
	const covers = await folder("표지");
	const covers2026 = await folder("2026", covers);
	const people = await folder("인물");
	const documents = await folder("문서");
	const old = await folder("지난 행사");
	media = {
		harbor: await upload("harbor.png", "항구.png", covers2026),
		forest: await upload("forest.png", "숲.png", covers2026),
		desert: await upload("desert.png", "사막.png", covers2026),
		night: await upload("night.png", "밤하늘.png", covers),
		portrait: await upload("portrait.png", "프로필.png", people),
		// Used nowhere: the library's "not used" filter finds it.
		unused: await upload("unused.png", "쓰지 않는 그림.png", null),
		pdf: await upload("price-list.pdf", "요금표.pdf", documents),
		csv: await upload("schedule.csv", "일정.csv", documents),
	};
	// In the trash: a picture on its own, and a folder with a file in it.
	const trashed = await upload("unused.png", "지운 배너.png", null);
	await upload("unused.png", "지난 포스터.png", old);
	await write("trash.move", { rows: [{ kind: "media", id: trashed }] });
	await write("trash.move", { rows: [{ kind: "folder", id: old }] });
} else {
	console.warn("The site has no storage (MONTI_STORAGE=off): no pictures or files are seeded.");
}
const picture = (key: keyof Media, alt?: string) =>
	media ? { media: media[key], ...(alt ? { alt } : {}) } : undefined;

// ── Items: tags (a taxonomy), people (linked from both sides), series (data only) ───────────────────────────────────────────────────────

async function item(collection: string, title: string, slug: string, values: Record<string, unknown> = {}) {
	const { id } = await write("entries.create", { collection, title, slug, values });
	return { id, group: await groupOf(id) };
}
/** An item's translations, all languages of one item in one save (the item panel's way). */
const itemLocales = (collection: string, group: string, locales: Record<string, Record<string, unknown>>) =>
	write("items.saveGroup", { collection, group, locales });

const tags = {
	sea: await item("tag", "바다", "sea", { description: "바다와 항구에 관한 글" }),
	forest: await item("tag", "숲", "forest", { description: "숲길과 나무" }),
	desert: await item("tag", "사막", "desert"),
	night: await item("tag", "밤", "night", { description: "해가 진 뒤의 풍경" }),
	walk: await item("tag", "걷기", "walking"),
	// Used by no entry: the tag list's "Unused" filter finds it.
	winter: await item("tag", "겨울", "winter"),
};
// English for every tag, Japanese for two: the language is partly done.
for (const [key, title, description] of [
	["sea", "Sea", "Writing on the sea and harbors"],
	["forest", "Forest", "Forest paths and trees"],
	["desert", "Desert", undefined],
	["night", "Night", "After the sun goes down"],
	["walk", "Walking", undefined],
	["winter", "Winter", undefined],
] as const)
	await itemLocales("tag", tags[key].group, {
		en: { title, slug: title.toLowerCase(), values: description ? { description } : {} },
	});
await itemLocales("tag", tags.sea.group, { ja: { title: "海", values: { description: "海と港の話" } } });
await itemLocales("tag", tags.forest.group, { ja: { title: "森" } });

const people = {
	kim: await item("person", "김하늘", "kim-haneul", {
		bio: "계절마다 한 도시를 걷고 기록한다.",
		roles: ["writer", "editor"],
		photo: picture("portrait", "김하늘의 얼굴"),
	}),
	lee: await item("person", "이바다", "lee-bada", { bio: "항구와 바다를 찍는 사진가.", roles: ["photographer"] }),
};
await itemLocales("person", people.kim.group, {
	en: { title: "Haneul Kim", values: { bio: "Walks one city each season and writes it down." } },
});

const series = {
	seasons: await item("series", "계절 여행", "seasons", { note: "봄부터 겨울까지 네 편" }),
	city: await item("series", "도시 산책", "city-walks"),
};
await itemLocales("series", series.seasons.group, {
	en: { title: "Travels by season", values: { note: "Four parts, spring to winter" } },
});

// ── A body template ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const template = await write("templates.save", {
	name: "여행 안내서",
	doc: doc(
		heading("t-h1", 2, "한눈에 보기"),
		p("t-p1", t("이 여행을 한 문단으로 적는다.")),
		heading("t-h2", 2, "가는 길"),
		numbers("t-l1", [[t("출발")], [t("갈아타기")], [t("도착")]]),
		heading("t-h3", 2, "챙길 것"),
		checklist("t-c1", [
			[[t("지도")], false],
			[[t("물")], false],
		]),
	),
});

// ── Articles: folders, then one entry per state and feature ─────────────────────────────────────────────────────────────────────────

const articleFolder = (name: string, parentId: string | null = null) =>
	write("folders.create", { scope: { collection: "article" }, parentId, name }).then((made) => made.id);
const guides = await articleFolder("안내");
const domestic = await articleFolder("국내", guides);
const news = await articleFolder("소식");

async function article(input: {
	title: string;
	slug: string;
	values?: Record<string, unknown>;
	doc?: unknown;
	template?: string;
}) {
	const { id } = await write("entries.create", { collection: "article", ...input });
	return { id, group: await groupOf(id) };
}
const save = async (id: string, change: Record<string, unknown>) =>
	write("entries.save", { id, version: (await entryOf(id)).version, ...change });
const publish = (...ids: string[]) => write<{ published: string[]; blocked: string[] }>("entries.publish", { ids });

// Made first, so the long article can link to it from its body.
const video = await article({
	title: "항구를 걷는 영상",
	slug: "harbor-video",
	values: {
		summary: "새벽 항구를 한 바퀴 걷는 12분짜리 영상.",
		subtitle: "새벽 다섯 시의 부두",
		topic: "news",
		seasons: ["winter"],
		cover: picture("harbor", "새벽 항구의 부두"),
		tags: [tags.sea.group, tags.walk.group],
		authors: [people.lee.group],
		format: "video",
		videoUrl: "https://example.com/videos/harbor",
		videoLength: "12:04",
	},
	doc: doc(
		p("v-p1", t("배가 들어오기 전의 항구는 조용하다.")),
		p("v-p2", t("영상은 등대에서 시작해 어시장에서 끝난다.")),
	),
});

const every = await article({
	title: "블록과 서식을 모두 쓴 글",
	slug: "every-block",
	values: {
		summary: "본문의 모든 블록과 글자 서식을 한 글에 모았다. 사이트에서 어떻게 그려지는지 볼 수 있다.",
		subtitle: "편집기의 모든 것",
		topic: "guide",
		seasons: ["spring", "summer"],
		cover: picture("forest", "아침 햇빛이 드는 숲"),
		attachment: media ? { media: media.pdf } : undefined,
		series: series.seasons.group,
		tags: [tags.forest.group, tags.walk.group, "new:처음 만든 태그"],
		authors: [people.kim.group, people.lee.group],
		format: "text",
		pinned: "pinned",
		pinNote: "이 글부터 보세요",
		// The SEO plugin's fields, in its own tab.
		seoTitle: "모든 블록 보기 | Monti 쇼케이스",
		seoDescription: "Monti 본문의 블록과 서식이 사이트에서 그려지는 모습.",
	},
	doc: doc(
		p(
			"e-intro",
			t("이 글은 "),
			t("굵게", bold),
			t(", "),
			t("기울임", italic),
			t(", "),
			t("밑줄", underline),
			t(", "),
			t("취소선", strike),
			t(", "),
			t("코드", code),
			t(", 위첨자 x"),
			t("2", sup),
			t(", 아래첨자 H"),
			t("2", sub),
			t("O를 쓴다."),
		),
		p(
			"e-links",
			t("바깥 링크는 "),
			t("Monti 저장소", link("https://github.com/monti-cms/monti")),
			t("로, 안쪽 링크는 "),
			t("항구 영상 글", link(entryLink(video.group))),
			t("로 간다. 각주도 있다"),
			ref("n1"),
			t("."),
		),
		heading("e-h-text", 2, "글자 블록"),
		aligned("e-center", "center", t("가운데 맞춘 문단")),
		aligned("e-right", "right", t("오른쪽 맞춘 문단"), { type: "hardBreak" }, t("줄을 바꾼 둘째 줄")),
		heading("e-h-lists", 3, "목록"),
		bullets("e-bullets", [[t("점 목록 하나")], [t("점 목록 둘, "), t("굵게", bold)]]),
		numbers("e-numbers", [[t("셋째부터 세는 번호")], [t("넷째")]], 3),
		checklist("e-check", [
			[[t("끝낸 일")], true],
			[[t("남은 일")], false],
		]),
		heading("e-h-quote", 4, "인용"),
		quote("e-quote", p("e-quote-p", t("길은 걷는 사람이 만든다.")), bullets("e-quote-list", [[t("인용 안의 목록")]])),
		heading("e-h-code", 2, "코드와 표"),
		codeBlock("e-code", "ts", 'const greeting = "안녕하세요";\nconsole.log(greeting);'),
		table(
			"e-table",
			[
				["장소", "계절", "요금"],
				["항구", "겨울", "12,000원"],
				["숲", "여름", "8,000원"],
			],
			[40, 30, 30],
		),
		divider("e-divider"),
		heading("e-h-media", 2, "그림과 파일"),
		...(media
			? [
					image("e-img-wide", {
						media: media.forest,
						alt: "숲길",
						caption: "본문 폭의 80%로 가운데",
						widthPercent: 80,
						align: "center",
					}),
					image("e-img-crop", {
						media: media.desert,
						alt: "잘라 돌린 사막",
						caption: "240px, 왼쪽, 잘라서 90도 돌림",
						width: 240,
						align: "left",
						crop: { x: 0.2, y: 0.1, width: 0.6, height: 0.8 },
						rotate: 90,
					}),
					image("e-img-deco", { media: media.night, decorative: true, width: 200, align: "right" }),
					file("e-file", media.pdf, "요금표 내려받기 (PDF)"),
					file("e-csv", media.csv),
				]
			: []),
		footnote("e-note", "n1", t("각주는 글 끝에 모여 그려진다.")),
	),
});

// ── Translations: English done and published, Japanese partly done (a draft with blocks left) ───────────────────────────────────────

type Words = Record<string, (block: Block) => Block>;
const words =
	(...content: Inline[]) =>
	(block: Block): Block => ({ ...block, content });

/** A translation: its fields, the blocks given translated (by the source block's id), and the rest kept in the source's words or left. */
async function translate(
	sourceId: string,
	locale: string,
	input: {
		title: string;
		slug?: string;
		values?: Record<string, unknown>;
		blocks: Words;
		rest: "keepSource" | "pending";
	},
) {
	const { id } = await write("translations.create", { source: sourceId, locale });
	const made = await entryOf(id);
	const body = made.doc as Doc;
	const blocks = body.blocks.map((block) => {
		const translated = block.link && input.blocks[block.link.from];
		return translated ? { ...translated(block), id: block.id, link: block.link } : block;
	});
	await write("entries.save", {
		id,
		version: made.version,
		title: input.title,
		...(input.slug ? { slug: input.slug } : {}),
		...(input.values ? { values: input.values } : {}),
		doc: { type: "doc", blocks },
	});
	if (input.rest === "keepSource") {
		const now = await entryOf(id);
		const pending = (now.doc as Doc).blocks.filter((block) => block.link?.state === "pending");
		if (pending.length > 0)
			await write("translations.setBlocks", {
				id,
				version: now.version,
				blocks: pending.map((block) => ({ do: "keepSource", block: block.id })),
			});
	}
	return id;
}

const everyEn = await translate(every.id, "en", {
	title: "Every block and mark in one entry",
	slug: "every-block",
	values: {
		summary: "Every block and text mark of the body in one entry, to see how the site draws them.",
		pinNote: "Start here",
	},
	blocks: {
		"e-intro": words(
			t("This entry uses "),
			t("bold", bold),
			t(", "),
			t("italic", italic),
			t(", "),
			t("underline", underline),
			t(", "),
			t("strike", strike),
			t(", "),
			t("code", code),
			t(", x"),
			t("2", sup),
			t(" and H"),
			t("2", sub),
			t("O."),
		),
		"e-h-text": words(t("Text blocks")),
		"e-center": words(t("A centered paragraph")),
		"e-h-lists": words(t("Lists")),
		"e-h-quote": words(t("Quote")),
		"e-h-code": words(t("Code and tables")),
		"e-h-media": words(t("Pictures and files")),
	},
	rest: "keepSource",
});

await translate(every.id, "ja", {
	title: "ブロックと書式をすべて使った記事",
	values: { summary: "本文のすべてのブロックと書式。" },
	blocks: { "e-h-text": words(t("テキストブロック")), "e-center": words(t("中央揃えの段落")) },
	// The rest stays to translate: the editor shows each pending block, and the draft cannot be published until they are decided.
	rest: "pending",
});

const videoEn = await translate(video.id, "en", {
	title: "A walk around the harbor, on video",
	values: { summary: "Twelve minutes around the harbor at dawn." },
	blocks: {
		"v-p1": words(t("Before the boats come in, the harbor is quiet.")),
		"v-p2": words(t("The video starts at the lighthouse and ends at the fish market.")),
	},
	rest: "keepSource",
});

// ── The other articles: one per state and option ────────────────────────────────────────────────────────────────────────────────────

const gallery = await article({
	title: "숲 사진첩",
	slug: "forest-gallery",
	values: {
		summary: "여름 숲에서 찍은 사진들.",
		topic: "guide",
		seasons: ["summer"],
		cover: picture("forest", "여름 숲의 나무들"),
		tags: [tags.forest.group],
		format: "gallery",
		galleryLayout: "grid",
		galleryPoster: picture("forest", "숲 사진첩의 대표 사진"),
		series: series.seasons.group,
	},
	doc: doc(
		p("g-p1", t("사진 몇 장으로 숲을 보여 준다.")),
		...(media ? [image("g-img", { media: media.forest, alt: "여름 숲" })] : []),
	),
});

const external = await article({
	title: "사막의 밤하늘 (바깥 링크)",
	slug: "desert-night-link",
	values: {
		summary: "다른 사이트의 별 사진 모음을 소개한다.",
		topic: "opinion",
		seasons: ["autumn"],
		cover: picture("night", "사막 위 밤하늘"),
		tags: [tags.desert.group, tags.night.group],
		format: "link",
		linkKind: "external",
		linkUrl: "https://example.com/stars",
	},
	doc: doc(p("x-p1", t("밤하늘이 가장 맑은 곳은 사막이다."))),
});

const internal = await article({
	title: "안내서에서 시작한 초안 (안쪽 링크)",
	slug: "from-template",
	template: template.id,
	values: { topic: "guide", format: "link", linkKind: "internal", linkTarget: every.group, series: series.city.group },
});

const archived = await article({
	title: "지난 봄 소식 (보관됨)",
	slug: "last-spring",
	values: { topic: "news", seasons: ["spring"] },
	doc: doc(p("o-p1", t("지난 봄에 알린 소식. 지금은 사이트에 없다."))),
});

const trashed = await article({
	title: "휴지통에 넣은 글",
	slug: "in-the-trash",
	values: { topic: "opinion" },
	doc: doc(p("t-p1", t("휴지통에서 30일 동안 되살릴 수 있다."))),
});

// Blocked: the option's required field is empty, so publishing lists it as a to-do.
await article({
	title: "영상 주소가 빠진 초안",
	slug: "missing-video-url",
	values: { topic: "news", format: "video" },
	// And a picture with no alt text: the publish to-do and the library's "missing alt text" find it.
	doc: doc(
		p("m-p1", t("영상을 골랐지만 주소를 아직 넣지 않았다.")),
		...(media ? [image("m-img", { media: media.harbor })] : []),
	),
});

// No address yet: an empty slug is a to-do too.
await article({ title: "주소 없는 초안", slug: "", values: { topic: "guide" } });

// Code blocks (doc 17): every line effect, regex rules, folds over lines and over words, a tooltip in code, a file name, line
// numbers, the site's languages, and code links from the text.
const counterCode = codeWithTools(
	"c-ts",
	"ts",
	`import { log } from "./log";
const LIMIT = 10;
export function counter(start = 0) {
  let count = start;
  const increment = () => {
    count++;
    count += 1;
    if (count > LIMIT) console.warn("over the limit, slow down please");
    if (Number.isNaN(count)) throw new Error("not a number");
    log("count", count);
    return count;
  };
  return { increment };
}`,
	{
		title: "src/counter.ts",
		lineNumbers: true,
		lines: [
			{ name: "highlight", start: 2, end: 3 },
			{ name: "minus", start: 5, end: 6 },
			{ name: "plus", start: 6, end: 7 },
			{ name: "warning", start: 7, end: 8 },
			{ name: "error", start: 8, end: 9 },
			{ name: "focus", start: 12, end: 13 },
			// A fold over the function's body, closed, with the line a code link names inside it.
			{ name: "collapse", start: 4, end: 12 },
			{ name: "anchor", start: 6, end: 7, attrs: { id: "c1" } },
		],
		rules: [
			// Every "count" in bold, a tooltip on "log" in the first line, and long strings folded.
			{ scope: "document", name: "bold", pattern: "\\bcount\\b", flags: "g" },
			{ scope: "line", line: 0, name: "codeTip", pattern: "log", flags: "", attrs: { text: "기록을 남기는 함수" } },
			{ scope: "document", name: "codeFold", pattern: '"[^"\\n]{20,}"', flags: "g" },
		],
	},
	[
		{ words: "LIMIT = 10", mark: { type: "codeTip", text: "한 번에 셀 수 있는 가장 큰 수" } },
		{ words: '"not a number"', mark: { type: "codeFold" } },
	],
);
const codeArticle = await article({
	title: "코드 블록 도구를 모두 쓴 글",
	slug: "code-tools",
	values: { summary: "줄 효과, 정규식 규칙, 접기, 코드 안의 툴팁, 코드 링크.", topic: "guide", format: "text" },
	doc: doc(
		p(
			"k-p1",
			t("카운터는 "),
			t("한 번에 하나씩 더한다", { type: "codeRef", block: "c-ts", anchor: "c1" }),
			t(". 이 글자를 가리키면 코드의 그 줄이 밝아지고, 누르면 접힌 곳을 펴고 그 줄로 간다."),
		),
		counterCode,
		heading("k-h1", 2, "언어마다 하나씩"),
		codeWithTools(
			"c-tsx",
			"tsx",
			'export function Button({ label }: { label: string }) {\n  return <button type="button">{label}</button>;\n}',
			{ title: "Button.tsx" },
		),
		codeWithTools("c-js", "js", "const total = [1, 2, 3].reduce((sum, n) => sum + n, 0);\nconsole.log(total);"),
		codeWithTools("c-json", "json", '{\n  "name": "monti-example-showcase",\n  "private": true\n}', {
			title: "package.json",
		}),
		codeWithTools("c-bash", "bash", "pnpm db:setup\npnpm seed\npnpm dev"),
		codeWithTools("c-css", "css", ".site {\n  max-width: 720px;\n  margin: 0 auto;\n}"),
		codeWithTools("c-html", "html", '<figure>\n  <img src="/cover.png" alt="표지" />\n</figure>'),
		codeWithTools("c-py", "python", 'def greet(name):\n    return f"안녕하세요, {name}"\n\nprint(greet("Monti"))', {
			lineNumbers: true,
			lines: [{ name: "collapse", start: 0, end: 2, attrs: { open: true } }],
		}),
	),
});

// A code link whose line is gone: the publish to-do lists it, and the editor draws it as broken.
await article({
	title: "끊긴 코드 링크가 있는 초안",
	slug: "broken-code-link",
	values: { topic: "guide" },
	doc: doc(
		p("z-p1", t("이 링크는 "), t("없는 줄", { type: "codeRef", block: "z-code", anchor: "c9" }), t("을 가리킨다.")),
		codeWithTools("z-code", "ts", "const answer = 42;"),
	),
});

// ── Relations from both sides, then states ──────────────────────────────────────────────────────────────────────────────────────────

await save(every.id, { values: { related: [video.group, gallery.group] } });
await save(video.id, { values: { related: [every.group] } });
// The person's side of `authors`: this save links the gallery and the link article to Lee, on their `authors`.
await save(people.lee.id, { values: { articles: [video.group, every.group, gallery.group, external.group] } });

const published = [every.id, video.id, gallery.id, external.id, archived.id, codeArticle.id, everyEn, videoEn];
for (const ids of [published.slice(0, 6), published.slice(6)]) {
	const { blocked } = await publish(...ids);
	if (blocked.length > 0) throw new Error(`Publishing was blocked for ${blocked.join(", ")}.`);
}

// Changed after publishing: the site still shows the published copy, the list shows "changed".
await save(gallery.id, { values: { subtitle: "고치는 중인 부제" } });

// The source changed after its English was published: the English shows the changed block, to update or keep.
await save(video.id, {
	doc: doc(
		p("v-p1", t("배가 들어오기 전의 새벽 항구는 아주 조용하다.")),
		p("v-p2", t("영상은 등대에서 시작해 어시장에서 끝난다.")),
		p("v-p3", t("새로 더한 문단: 끝에 갈매기 소리가 들린다.")),
	),
});
await publish(video.id);

// One Japanese page on the site: the link article, all its blocks translated and published.
const externalJa = await translate(external.id, "ja", {
	title: "砂漠の夜空（外部リンク）",
	values: { summary: "ほかのサイトの星の写真を紹介する。" },
	blocks: { "x-p1": words(t("夜空がいちばん澄んでいるのは砂漠だ。")) },
	rest: "keepSource",
});
if ((await publish(externalJa)).blocked.length > 0) throw new Error("The Japanese translation was not published.");

await write("entries.archive", { ids: [archived.id] });
await write("trash.move", { rows: [{ kind: "entry", id: trashed.id }] });
await write("entries.duplicate", { id: external.id });

await write("entries.moveToFolder", { ids: [every.id, gallery.id], folder: guides });
await write("entries.moveToFolder", { ids: [internal.id], folder: domestic });
await write("entries.moveToFolder", { ids: [video.id, archived.id], folder: news });

// ── Variants: each block and mark used in its different ways, one entry per family, with a heading over each example ──────────

const examples = await articleFolder("보기 모음");
const variant = async (title: string, slug: string, body: unknown, summary: string) =>
	article({ title, slug, values: { topic: "guide", format: "text", summary }, doc: body });
const codeBasicsEntry = await variant(
	"보기 모음 · 코드의 머리와 언어",
	"examples-code-basics",
	codeBasics(),
	"파일 이름, 줄 번호, 언어, 긴 코드.",
);
const variants = [
	await variant(
		"보기 모음 · 글자와 목록",
		"examples-text",
		textBlocks(entryLink(video.group)),
		"제목, 서식, 링크, 목록, 인용.",
	),
	await variant("보기 모음 · 표와 각주", "examples-tables", tableBlocks(), "표의 여러 모양과 각주."),
	...(media
		? [
				await variant(
					"보기 모음 · 그림과 파일",
					"examples-media",
					mediaBlocks(media),
					"그림의 크기, 맞춤, 자르기, 돌리기, 파일.",
				),
			]
		: []),
	codeBasicsEntry,
	await variant(
		"보기 모음 · 코드의 줄 효과와 접기",
		"examples-code-lines",
		codeLines(),
		"줄 효과 하나씩과 함께, 접기.",
	),
	await variant(
		"보기 모음 · 코드의 규칙, 서식, 링크",
		"examples-code-text",
		codeText(),
		"정규식 규칙, 코드 안의 서식, 툴팁, 코드 링크.",
	),
];
for (const { id } of variants) {
	const { blocked } = await publish(id);
	if (blocked.length > 0) throw new Error(`The example ${id} was not published.`);
}
await write("entries.moveToFolder", { ids: variants.map(({ id }) => id), folder: examples });

// The blocks `monti add` copied in (doc 18), each in its different ways: four more entries in the same folder.
const blockEntries = [
	await variant(
		"보기 모음 · 콜아웃과 접기",
		"examples-callouts",
		calloutsAndCollapsibles(media?.forest),
		"콜아웃 종류마다, 접기 열림과 닫힘.",
	),
	await variant(
		"보기 모음 · 탭과 단",
		"examples-tabs-columns",
		tabsAndColumns(media?.forest),
		"탭 둘에서 여덟, 단 둘에서 넷.",
	),
	await variant(
		"보기 모음 · 수식, 다이어그램, 차트",
		"examples-diagrams",
		formulasDiagramsCharts(),
		"수식, Mermaid 다이어그램, 차트: 읽히지 않는 것까지.",
	),
	await variant(
		"보기 모음 · 코드 탐색기와 글자 표시",
		"examples-explorer-marks",
		explorersAndMarks(),
		"코드 탐색기, 글자 색, 툴팁.",
	),
];
for (const { id } of blockEntries) {
	const { blocked } = await publish(id);
	if (blocked.length > 0) throw new Error(`The block example ${id} was not published.`);
}
await write("entries.moveToFolder", { ids: blockEntries.map(({ id }) => id), folder: examples });

// A code entry in English (its code follows the source; its words are translated), and one archived: read only.
const basicsEn = await translate(codeBasicsEntry.id, "en", {
	title: "Examples · the code's head and languages",
	values: { summary: "File names, line numbers, languages, long code." },
	blocks: {
		"cb-head": words(t("The head line")),
		"cb-numbers": words(t("Line numbers")),
		"cb-langs": words(t("Languages")),
		"cb-size": words(t("Length")),
	},
	rest: "keepSource",
});
if ((await publish(basicsEn)).blocked.length > 0) throw new Error("The English code example was not published.");
const archivedCode = await article({
	title: "보관된 코드 글",
	slug: "archived-code",
	values: { topic: "guide" },
	doc: doc(
		p("ac-p", t("보관된 글의 코드는 읽기만 된다.")),
		codeWithTools("ac-c", "ts", "export const archived = true;", { title: "archived.ts", lineNumbers: true }),
	),
});
await publish(archivedCode.id);
await write("entries.archive", { ids: [archivedCode.id] });

const failed = await read<number>("deliveries.counts", {});
console.log(
	[
		"Seeded: 4 media folders and 8 files (2 more in the trash), 6 tags, 2 people, 2 series, 1 template,",
		"23 articles (published, changed, draft, blocked, archived, in the trash, a copy, code tools, ten example entries)",
		"with English and Japanese translations.",
		`Deliveries: ${JSON.stringify(failed)} (the broken hook fails on purpose).`,
	].join("\n"),
);
await monti.db.destroy();
