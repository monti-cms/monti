import { readSamples } from "../../../mdx/__test__/fixtures/samples";

const MEDIA_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_MEDIA_ID = "22222222-2222-4222-8222-222222222222";

const fence = (lines: string[], lang = "ts") => [`\`\`\`${lang}`, ...lines, "```"].join("\n");
const cell = (text: string, attrs = "") => `<TableCell${attrs ? ` ${attrs}` : ""}>${text}</TableCell>`;
const table = (rows: string[][]) =>
	["<Table>", ...rows.flatMap((cells) => ["<TableRow>", ...cells, "</TableRow>"]), "</Table>"].join("\n");

/**
 * Bodies the parity suite runs the stored-document checks over: the real posts of the samples directory, and one small body per rule
 * (each pre-publish check, each way a body is read). Written as standard MDX (JSX), which every site config reads.
 */
const rules: { name: string; mdx: string }[] = [
	{ name: "empty", mdx: "" },
	{ name: "blank", mdx: "\n\n" },
	{ name: "plain paragraph", mdx: "Hello world.\n" },
	{ name: "emphasis variants", mdx: "An *a* and _b_ and **c** and ~~d~~ and `e` word.\n" },
	{
		name: "headings and lists",
		mdx: "# A\n\n## B\n\n- one\n- two\n  - nested\n\n1. x\n2. y\n\n- [ ] todo\n- [x] done\n",
	},
	{ name: "blockquote and rule", mdx: "> quote\n> more\n\n---\n\nAfter.\n" },
	{ name: "hard break", mdx: "line one<br />line two\n" },
	{ name: "internal link", mdx: "See [a post](/posts/nextjs-guide) and [a memo](/memos/note).\n" },
	{ name: "internal link with marks", mdx: "See [a **bold** link](/posts/nextjs-guide) here.\n" },
	{ name: "external link", mdx: "See [site](https://example.com/x).\n" },
	{ name: "reference link", mdx: "See [a post][p].\n\n[p]: /posts/nextjs-guide\n" },
	{ name: "same-site absolute link", mdx: "See [a post](https://example.dev/posts/abc).\n" },
	{ name: "media image", mdx: `<Image mediaId="${MEDIA_ID}" alt="A picture" />\n` },
	{ name: "media image without alt", mdx: `<Image mediaId="${MEDIA_ID}" />\n` },
	{ name: "decorative media image", mdx: `<Image mediaId="${MEDIA_ID}" decorative />\n` },
	{ name: "image with bad media id", mdx: `<Image mediaId="not-a-uuid" alt="x" />\n` },
	{ name: "image with no source", mdx: `<Image alt="x" />\n` },
	{ name: "external image", mdx: `<Image src="https://example.com/a.png" alt="x" />\n` },
	{
		name: "markdown images",
		mdx: "![outside](https://example.com/a.png)\n\ntext ![inline](https://example.com/b.png) text\n",
	},
	{ name: "image with options", mdx: `<Image mediaId="${MEDIA_ID}" alt="a" align="middle" width="50%" />\n` },
	{
		name: "two images same media",
		mdx: `<Image mediaId="${MEDIA_ID}" alt="a" />\n\n<Image mediaId="${MEDIA_ID}" alt="b" />\n\n<Image mediaId="${OTHER_MEDIA_ID}" alt="c" />\n`,
	},
	{ name: "file card", mdx: `<File mediaId="${MEDIA_ID}" label="report.pdf" />\n` },
	{ name: "file without media id", mdx: `<File label="report.pdf" />\n` },
	{ name: "text align", mdx: '<TextAlign align="center">\n\nCentered.\n\n</TextAlign>\n' },
	{ name: "text align bad option", mdx: '<TextAlign align="bogus">\n\nAligned.\n\n</TextAlign>\n' },
	{ name: "text align missing", mdx: "<TextAlign>\n\nAligned.\n\n</TextAlign>\n" },
	{ name: "callout", mdx: '<Callout variant="note" title="Heads up">\n\nBody.\n\n</Callout>\n' },
	{ name: "callout unknown attribute", mdx: '<Callout variant="note" mood="happy">\n\nBody.\n\n</Callout>\n' },
	{ name: "callout bad option", mdx: '<Callout variant="loud">\n\nBody.\n\n</Callout>\n' },
	{
		name: "tabs",
		mdx: '<Tabs defaultValue="B">\n\n<Tab label="A">\n\na\n\n</Tab>\n\n<Tab label="B">\n\nb\n\n</Tab>\n\n</Tabs>\n',
	},
	{
		name: "tabs with unknown active tab",
		mdx: '<Tabs defaultValue="Z">\n\n<Tab label="A">\n\na\n\n</Tab>\n\n<Tab label="B">\n\nb\n\n</Tab>\n\n</Tabs>\n',
	},
	{ name: "tab missing label", mdx: '<Tabs>\n\n<Tab>\n\na\n\n</Tab>\n\n<Tab label="B">\n\nb\n\n</Tab>\n\n</Tabs>\n' },
	{ name: "tooltip", mdx: 'A <Tooltip content="hint">term</Tooltip> here.\n' },
	{ name: "tooltip without content", mdx: "A <Tooltip>term</Tooltip> here.\n" },
	{ name: "tooltip with marks", mdx: 'A <Tooltip content="hint">long **bold** term</Tooltip> here.\n' },
	{ name: "untranslated", mdx: "<Untranslated>Source text</Untranslated> and <Untranslated>more</Untranslated>.\n" },
	{ name: "untranslated with break", mdx: "<Untranslated>a<br />b</Untranslated>\n" },
	{ name: "code block", mdx: `${fence(["const a = 1;"])}\n` },
	// A ranged annotation that starts past the last code line is covered by `code-annotations-snapshot.test.ts`.
	{
		name: "code refs resolved",
		mdx: `See <CodeRef to="c1">the sum</CodeRef> and <CodeRef to="c1">it again</CodeRef>.\n\n${fence(['// @line anchor {1-1} id="c1"', "const a = 1;", "const b = a + 1;"])}\n`,
	},
	{
		name: "code ref broken",
		mdx: `Intro.\n\nSee <CodeRef to="c9">gone</CodeRef>.\n\n${fence(['// @line anchor {0-0} id="c1"', "x();"])}\n`,
	},
	{
		name: "code anchor duplicate",
		mdx: `<CodeRef to="c1">x</CodeRef>\n\n${fence(['// @line anchor {0-0} id="c1"', "x();"])}\n\n${fence(['// @line anchor {0-0} id="c1"', "y();"])}\n`,
	},
	{ name: "code ref without target", mdx: "See <CodeRef>x</CodeRef>.\n" },
	{ name: "math", mdx: "$$\nx^2 + y^2 = z^2\n$$\n" },
	{ name: "footnotes ok", mdx: "A claim[^1].\n\n[^1]: The source.\n" },
	{ name: "footnote unused", mdx: "Text.\n\n[^spare]: Nobody cites me.\n" },
	{ name: "footnote missing", mdx: "Cites[^gone] a note.\n" },
	{ name: "footnote duplicate definition", mdx: "A[^1].\n\n[^1]: One.\n\n[^1]: Two.\n" },
	{ name: "footnote case-insensitive", mdx: "A[^Note].\n\n[^note]: Text.\n" },
	{ name: "escaped footnote marker", mdx: "Not a note \\[^a] here.\n" },
	{ name: "table pipe", mdx: "| a | b |\n| - | - |\n| 1 | 2 |\n| 3 | 4 |\n" },
	{ name: "table pipe aligned", mdx: "| a | b |\n| :- | -: |\n| 1 | 2 |\n" },
	{ name: "table pipe short row", mdx: "| a | b |\n| - | - |\n| 1 |\n" },
	{
		name: "table merged ok",
		mdx: table([[cell("제목", 'header colspan="2"')], [cell("값1", 'rowspan="2"'), cell("값2")], [cell("값3")]]),
	},
	{ name: "table ragged", mdx: table([[cell("a"), cell("b")], [cell("c")]]) },
	{ name: "table overlap", mdx: table([[cell("a", 'rowspan="2"'), cell("b")], [cell("c", 'colspan="2"')]]) },
	{ name: "table huge span", mdx: table([[cell("앞"), cell("위험", 'colspan="1000000000"')]]) },
	{ name: "table bad span", mdx: table([[cell("a", 'colspan="abc"')]]) },
	{ name: "table rowspan overflow", mdx: table([[cell("a", 'rowspan="5"')]]) },
	{ name: "html comment", mdx: "<!-- note -->\n\nText.\n" },
	{ name: "expression block", mdx: "{/* comment */}\n\nText.\n" },
	{ name: "jsx fragment", mdx: "<>\n\nInside.\n\n</>\n" },
	{ name: "frontmatter", mdx: "---\ntitle: x\n---\n\nBody.\n" },
	{ name: "unclosed jsx", mdx: "<Callout>\n\nBody.\n" },
	{ name: "disallowed element", mdx: "<Danger>x</Danger>\n" },
	{ name: "esm", mdx: 'import x from "y";\n\nText.\n' },
	{ name: "event handler", mdx: '<Callout onClick="x">\n\nBody.\n\n</Callout>\n' },
	{ name: "spread attribute", mdx: "<Callout {...a}>\n\nBody.\n\n</Callout>\n" },
	{ name: "korean text", mdx: "한글 본문입니다. **굵게** 그리고 [링크](/posts/한글).\n" },
	{
		name: "mixed",
		mdx: `# Title\n\nIntro with [a post](/posts/a) and a[^1].\n\n<Image mediaId="${MEDIA_ID}" alt="x" />\n\n<Callout variant="tip">\n\nInside <Tooltip content="t">tip</Tooltip>.\n\n</Callout>\n\n[^1]: Note.\n`,
	},
];

/** All bodies: the sample posts and the rule bodies. */
export const parityCorpus = (): { name: string; mdx: string }[] => [
	...readSamples().map((sample) => ({ name: `sample ${sample.name}`, mdx: sample.mdx })),
	...rules,
];
