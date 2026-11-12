import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { problems } from "./check-banner-place.mjs";

const UI = 'import { Banner, Box, PageBanner, PageBody, SidebarInset, Stack, StandalonePage } from "@monti-cms/ui";\n';
const SESSION = "packages/admin/src/screens/frame/session-ended.tsx";
/** A component that returns a banner, behind a condition, as the admin's own do. */
const sessionEnded = `${UI}export function SessionEndedBanner() {
	const ended = useSession();
	if (!ended) return null;
	return <Banner tone="danger" title="ended" />;
}
`;
const screen = (body, more = "") =>
	`${UI}import { SessionEndedBanner } from "../frame/session-ended";\n${more}export function Screen({ refused }) {\n\treturn (\n${body}\n\t);\n}\n`;
/** The lines the check finds in one screen beside the session banner's file, as `line: first words`. */
const check = (body, more) =>
	problems({ [SESSION]: sessionEnded, "packages/admin/src/screens/settings/screen.tsx": screen(body, more) }).map(
		({ file, line, message }) => `${path.basename(file)}:${line}: ${message.split(". ")[0]}`,
	);

test("a page's banner inside PageBanner, and banners in the banner of the frame and of a standalone page: nothing to fix", () => {
	assert.deepEqual(
		check("<PageBody><PageBanner>{refused ? <Banner title={refused} /> : null}</PageBanner></PageBody>"),
		[],
	);
	assert.deepEqual(
		check("<SidebarInset banner={<><SessionEndedBanner /><Banner title={refused} /></>}><PageBody /></SidebarInset>"),
		[],
	);
	assert.deepEqual(
		check("<StandalonePage banner={refused && <Banner title={refused} />}><PageBody /></StandalonePage>"),
		[],
	);
});

test("a banner inside the page is named with its line and where it belongs", () => {
	const found = problems({
		"packages/admin/src/screens/settings/screen.tsx": screen(
			"\t\t<PageBody>\n\t\t\t{refused ? <Banner title={refused} /> : null}\n\t\t</PageBody>",
		),
	});
	assert.equal(found.length, 1);
	assert.equal(found[0].file, "packages/admin/src/screens/settings/screen.tsx");
	assert.equal(found[0].line, 6);
	assert.match(found[0].message, /^<Banner> is drawn outside the top place\. .*<PageBanner>.*<StandalonePage>/);
});

test("a banner as the first child of the screen's own column is not in a top place: the place is a part's, not a position", () => {
	assert.deepEqual(check('<Stack height="screen"><Banner title={refused} /><PageBody /></Stack>'), [
		"screen.tsx:5: <Banner> is drawn outside the top place",
	]);
});

test("a component that returns a banner is held to the same rule where it is drawn, through other files and other components", () => {
	assert.deepEqual(check("<PageBody><SessionEndedBanner /></PageBody>"), [
		"screen.tsx:5: <SessionEndedBanner> is drawn outside the top place",
	]);
	const wrapped = 'const Both = () => (\n\t<>\n\t\t<SessionEndedBanner />\n\t\t<Banner title="more" />\n\t</>\n);\n';
	assert.deepEqual(check("<PageBody><Both /></PageBody>", wrapped), [
		"screen.tsx:11: <Both> is drawn outside the top place",
	]);
	assert.deepEqual(check("<StandalonePage banner={<Both />}><PageBody /></StandalonePage>", wrapped), []);
});

test("a banner called as a function, kept in a variable, or given under another prop is not in a top place", () => {
	const helper = "function refusal(reason) {\n\treturn <Banner title={reason} />;\n}\n";
	assert.deepEqual(check("<PageBody>{refusal(refused)}</PageBody>", helper), [
		"screen.tsx:8: refusal() is drawn outside the top place",
	]);
	const kept = 'const kept = <Banner title="kept" />;\n';
	assert.deepEqual(check("<PageBody>{kept}</PageBody>", kept), [
		"screen.tsx:3: <Banner> is drawn outside the top place",
	]);
	assert.deepEqual(check("<PageBody header={<Banner title={refused} />} />"), [
		"screen.tsx:5: <Banner> is drawn outside the top place",
	]);
	assert.deepEqual(check("<PageBody>{[1].map(() => <Banner title={refused} />)}</PageBody>"), [
		"screen.tsx:5: <Banner> is drawn outside the top place",
	]);
});

test("a banner returned in a fragment with the page is named: the page would stand in the top place with it", () => {
	assert.deepEqual(check("<>\n<Banner title={refused} />\n<PageBody />\n</>"), [
		"screen.tsx:7: a banner is returned in a fragment with something that is not one",
	]);
});

test("a component with a banner prop is a top place when it passes the prop on to one, and is named when it does not", () => {
	const frame = (body) =>
		`${UI}export function Frame({ banner, children }: { banner?: React.ReactNode; children?: React.ReactNode } = {}) {\n\treturn (\n${body}\n\t);\n}\n`;
	const list = `${UI}import { Frame } from "./frame";\nexport const List = () => <Frame banner={<Banner title="ended" />} />;\n`;
	const files = (body) => ({
		"packages/ui/src/screens/reference/frame.tsx": frame(body),
		"packages/ui/src/screens/reference/list.tsx": list,
	});
	assert.deepEqual(problems(files("<SidebarInset banner={banner}>{children}</SidebarInset>")), []);
	assert.deepEqual(
		problems(files("<SidebarInset>{banner ? <PageBanner>{banner}</PageBanner> : null}{children}</SidebarInset>")),
		[],
	);
	const under = problems(files("<SidebarInset><PageBody />{banner}{children}</SidebarInset>"));
	assert.equal(under.length, 1);
	assert.equal(under[0].file, "packages/ui/src/screens/reference/frame.tsx");
	assert.match(under[0].message, /^the `banner` prop holds a banner and is passed on outside the top place/);
});

test("a banner prop on a component the check does not know is not a top place", () => {
	assert.deepEqual(
		check("<Elsewhere banner={<Banner title={refused} />} />", 'import { Elsewhere } from "some-package";\n'),
		["screen.tsx:6: <Banner> is drawn outside the top place"],
	);
});

test("a reference screen takes the parts from the package's own files, and a part named Banner from elsewhere is not one", () => {
	const reference =
		'import { Banner, PageBody } from "../../index";\nexport const Keys = () => <PageBody><Banner title="keys" /></PageBody>;\n';
	assert.equal(problems({ "packages/ui/src/screens/reference/api-keys.tsx": reference }).length, 1);
	const other = 'import { Banner } from "./marketing";\nexport const Page = () => <div><Banner /></div>;\n';
	assert.deepEqual(problems({ "packages/admin/src/screens/login/page.tsx": other }), []);
});

test("a file that cannot be parsed is said, not passed", () => {
	const found = problems({ "packages/admin/src/screens/broken.tsx": "export const = <" });
	assert.equal(found.length, 1);
	assert.match(found[0].message, /cannot be parsed/);
});
