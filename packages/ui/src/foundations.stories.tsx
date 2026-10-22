/// <reference types="vite/client" />
import type { Meta, StoryObj } from "@storybook/react-vite";
import themeCss from "../styles/theme.css?raw";
import tokensCss from "../styles/tokens.css?raw";
import { Stack } from "./stack";
import { Text } from "./text";

/**
 * The tokens, read from the token files themselves (`styles/theme.css` for the names, `styles/tokens.css` for the values), so this page
 * cannot drift from what the components use. Switch light and dark with the toolbar.
 */
const meta = { title: "Foundations/Tokens" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** `--name: value;` pairs of the first (light) block of `tokens.css`, in file order. */
const lightBlock = tokensCss.slice(tokensCss.indexOf("{") + 1, tokensCss.indexOf("\n}"));
const declared = [...lightBlock.matchAll(/^\t(--monti-[\w-]+):\s*([^;]+);/gm)].map(([, name, value]) => ({
	name,
	value,
}));
/** Classes the theme defines per namespace: `--background-color-monti-surface: var(--monti-bg-surface)` → class `bg-monti-surface`. */
const themed = (namespace: string, prefix: string) =>
	[...themeCss.matchAll(new RegExp(`--${namespace}-monti-([\\w-]+?):\\s*var\\((--monti-[\\w-]+)\\)`, "g"))].map(
		([, role, variable]) => ({ className: `${prefix}-monti-${role}`, variable }),
	);

function Swatch({ color, name, detail }: { color: string; name: string; detail?: string }) {
	return (
		<Stack gap="tight" className="w-36">
			<div className="h-12 rounded-md border border-monti-muted" style={{ background: `var(${color})` }} />
			<Text variant="caption" mono>
				{name}
			</Text>
			{detail && (
				<Text variant="micro" tone="muted" mono truncate>
					{detail}
				</Text>
			)}
		</Stack>
	);
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<Stack gap="normal">
			<Text variant="title">{title}</Text>
			<Stack direction="row" gap="comfortable" wrap>
				{children}
			</Stack>
		</Stack>
	);
}

/** The raw values: gray 1-12 and each hue at steps 3 (soft fill), 6 (soft border), 9 (solid), 10 (solid hover), 11 (text). Screens never use these. */
export const Scales: Story = {
	render: () => {
		const scales = declared.filter(({ name }) => /^--monti-(gray|accent|danger|warning|success)-\d+$/.test(name));
		const families = [...new Set(scales.map(({ name }) => name.replace(/^--monti-|-\d+$/g, "")))];
		return (
			<Stack gap="spacious">
				{families.map((family) => (
					<Group key={family} title={family}>
						{scales
							.filter(({ name }) => name.startsWith(`--monti-${family}-`))
							.map(({ name }) => (
								<Swatch key={name} color={name} name={name.replace("--monti-", "")} />
							))}
					</Group>
				))}
			</Stack>
		);
	},
};

/** What screens use: one name per property. The swatch shows the role; the line under it, the class. */
export const ColorRoles: Story = {
	render: () => (
		<Stack gap="spacious">
			<Group title="Background (bg-monti-*)">
				{themed("background-color", "bg").map(({ className, variable }) => (
					<Swatch key={className} color={variable} name={className} />
				))}
			</Group>
			<Group title="Text (text-monti-*)">
				{themed("text-color", "text").map(({ className, variable }) => (
					<Stack key={className} gap="tight" className="w-36">
						<div className="text-monti-title" style={{ color: `var(${variable})` }}>
							가나다 Aa
						</div>
						<Text variant="caption" mono>
							{className}
						</Text>
					</Stack>
				))}
			</Group>
			<Group title="Border (border-monti-*)">
				{themed("border-color", "border").map(({ className, variable }) => (
					<Stack key={className} gap="tight" className="w-36">
						<div className="h-12 rounded-md border-2" style={{ borderColor: `var(${variable})` }} />
						<Text variant="caption" mono>
							{className}
						</Text>
					</Stack>
				))}
			</Group>
		</Stack>
	),
};

const SAMPLE: Record<string, string> = {
	display: "글 제목은 이 크기예요",
	heading: "설정",
	title: "섹션 제목",
	reading: "에디터 본문은 이 크기로 읽고 써요. 긴 글을 편하게 읽을 수 있는 줄 간격이에요.",
	body: "기본 글자와 입력 칸, 설명이에요.",
	label: "버튼, 탭, 메뉴 항목",
	caption: "메타 정보 · 3분 전",
	micro: "⌘S · 12",
};

/** Type roles: size, line height and weight in one class. */
export const Typography: Story = {
	render: () => {
		const roles = [...themeCss.matchAll(/--text-monti-(\w+):\s*(\d+px);/g)].map(([, role, size]) => {
			const meta = (key: string) => themeCss.match(new RegExp(`--text-monti-${role}--${key}:\\s*([^;]+);`))?.[1];
			return { role, size, weight: meta("font-weight"), lineHeight: meta("line-height") };
		});
		return (
			<Stack gap="comfortable">
				{roles.map(({ role, size, weight, lineHeight }) => (
					<Stack key={role} direction="row" gap="spacious" align="baseline">
						<Stack gap="none" className="w-40 shrink-0">
							<Text variant="label" mono>
								text-monti-{role}
							</Text>
							<Text variant="caption" tone="muted">
								{size} / {lineHeight} · {weight}
							</Text>
						</Stack>
						<Text variant={role as "body"}>{SAMPLE[role] ?? role}</Text>
					</Stack>
				))}
				<Stack direction="row" gap="spacious" align="baseline">
					<Stack gap="none" className="w-40 shrink-0">
						<Text variant="label" mono>
							font-mono
						</Text>
						<Text variant="caption" tone="muted">
							코드, 슬러그, 경로
						</Text>
					</Stack>
					<Text variant="body" mono>
						/posts/cms-elements-details
					</Text>
				</Stack>
			</Stack>
		);
	},
};

/** The named spacing from the theme (`--spacing-<name>: <px>`), in file order. */
const SPACING = [...themeCss.matchAll(/--spacing-([a-z]+):\s*(\d+)px;/g)].map(([, name, px]) => ({
	name,
	px: Number(px),
}));

/** The spacing screens use for gaps, padding and margins: a name, never a number (`gap-condensed`, `px-comfortable`, `-mt-tight`). */
export const Spacing: Story = {
	render: () => (
		<Stack gap="normal">
			{SPACING.map(({ name, px }) => (
				<Stack key={name} direction="row" gap="spacious" align="center">
					<Text variant="label" mono className="w-24 shrink-0">
						{name}
					</Text>
					<div className="h-4 rounded-sm bg-monti-accent-emphasis" style={{ width: px }} />
					<Text variant="caption" tone="muted" mono>
						{px}px · gap-{name} · p-{name} · m-{name}
					</Text>
				</Stack>
			))}
		</Stack>
	),
};

/** Corner radius (computed from `--monti-radius`) and the two heights: resting (a border) and floating (border and shadow). */
export const RadiusAndShadow: Story = {
	render: () => (
		<Stack gap="spacious">
			<Group title="Radius">
				{[
					["rounded-sm", "칩, 배지, 체크박스"],
					["rounded-md", "버튼, 입력 칸, 메뉴 항목"],
					["rounded-lg", "카드, 패널, 메뉴"],
					["rounded-xl", "대화상자, 시트"],
					["rounded-full", "스위치, 아바타, 점"],
				].map(([cls, use]) => (
					<Stack key={cls} gap="tight" className="w-36">
						<div className={`h-12 border border-monti-emphasis bg-monti-neutral ${cls}`} />
						<Text variant="caption" mono>
							{cls}
						</Text>
						<Text variant="micro" tone="muted">
							{use}
						</Text>
					</Stack>
				))}
			</Group>
			<Group title="Height">
				<Stack gap="tight" className="w-48">
					<div className="h-16 rounded-lg border border-monti-muted bg-monti-surface" />
					<Text variant="caption" mono>
						resting · border only
					</Text>
				</Stack>
				<Stack gap="tight" className="w-48">
					<div className="h-16 rounded-lg border border-monti-muted bg-monti-overlay shadow-monti-floating" />
					<Text variant="caption" mono>
						shadow-monti-floating
					</Text>
				</Stack>
			</Group>
		</Stack>
	),
};
