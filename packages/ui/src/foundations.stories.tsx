import type { Meta, StoryObj } from "@storybook/react-vite";
import tokens from "../tokens/tokens.json";
import { Stack } from "./stack";
import { Text } from "./text";

/**
 * The design system's tokens, read from `tokens/tokens.json` itself (the file `scripts/gen-tokens.mjs` writes `styles/tokens.css` and `styles/theme.css`
 * from), so this page cannot drift from what the components use. Every swatch shows the token's own usage line. Switch light and dark with the toolbar.
 */
const meta = { title: "Foundations/Tokens" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

type Named = { name: string; usage: string };
const colors = tokens.color.tokens;
/** Roles by property: `bg-tool` is the class `bg-monti-tool`. */
const roles = (prefix: string) => colors.filter(({ name }) => name.startsWith(`${prefix}-`));
const px = (name: string) => `var(--monti-${name})`;
/** The class a token is used through: `bg-tool` → `bg-monti-tool`, `fg-faint` → `text-monti-faint`, `width-sheet` → `w-monti-sheet`. */
const CLASS_PREFIX: Record<string, string> = { fg: "text", width: "w" };
const classOf = (token: string) => {
	const [group, ...rest] = token.split("-");
	return `${CLASS_PREFIX[group] ?? group}-monti-${rest.join("-")}`;
};

function Swatch({ name, label, usage }: { name: string; label: string; usage?: string }) {
	return (
		<Stack gap="tight" className="w-40">
			<div className="h-12 rounded-monti-md border border-monti-muted" style={{ background: px(name) }} />
			<Text variant="meta">{label}</Text>
			{usage && (
				<Text variant="note" tone="muted">
					{usage}
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

/** The raw values: gray 1-12 and the four tones at steps 3 (soft fill) and 11 (text). Screens never use these; they use the roles. */
export const Scales: Story = {
	render: () => (
		<Stack gap="spacious">
			{["gray", "success", "warning", "danger", "proposal"].map((family) => (
				<Group key={family} title={family}>
					{colors
						.filter(({ name }) => new RegExp(`^${family}-\\d+$`).test(name))
						.map(({ name, usage }) => (
							<Swatch key={name} name={name} label={name} usage={usage} />
						))}
				</Group>
			))}
		</Stack>
	),
};

/** What screens use: one name per property. The swatch shows the role; the line under it, the class and what it is for. */
export const ColorRoles: Story = {
	render: () => (
		<Stack gap="spacious">
			<Group title="Background (bg-monti-*)">
				{roles("bg").map(({ name, usage }) => (
					<Swatch key={name} name={name} label={classOf(name)} usage={usage} />
				))}
			</Group>
			<Group title="Text (text-monti-*)">
				{roles("fg").map(({ name, usage }) => (
					<Stack key={name} gap="tight" className="w-40">
						<div className="text-monti-title" style={{ color: px(name) }}>
							가나다 Aa
						</div>
						<Text variant="meta">{classOf(name)}</Text>
						<Text variant="note" tone="muted">
							{usage}
						</Text>
					</Stack>
				))}
			</Group>
			<Group title="Border (border-monti-*, also ring, outline, divide, decoration)">
				{roles("border").map(({ name, usage }) => (
					<Stack key={name} gap="tight" className="w-40">
						<div className="h-12 rounded-monti-md border-2" style={{ borderColor: px(name) }} />
						<Text variant="meta">{classOf(name)}</Text>
						<Text variant="note" tone="muted">
							{usage}
						</Text>
					</Stack>
				))}
			</Group>
		</Stack>
	),
};

/** Type roles: size, line height, weight, letter spacing and family in one class, `text-monti-<role>`. */
export const Typography: Story = {
	render: () => (
		<Stack gap="comfortable">
			{tokens.type.groups.flatMap((group) =>
				group.styles.map((style) => {
					const role = style.name.replace("text-", "");
					return (
						<Stack key={role} direction="row" gap="spacious" align="baseline">
							<Stack gap="none" className="w-48 shrink-0">
								<Text variant="label" mono>
									text-monti-{role}
								</Text>
								<Text variant="caption" tone="muted">
									{style.fontSize} / {style.lineHeight} · {style.fontWeight} · {group.family}
								</Text>
							</Stack>
							<Stack gap="hair">
								<Text variant={role as "body"}>{style.sample}</Text>
								<Text variant="note" tone="muted">
									{style.usage}
								</Text>
							</Stack>
						</Stack>
					);
				}),
			)}
		</Stack>
	),
};

/** The spacing screens use for gaps, padding and margins (`gap-monti-8`, `px-monti-16`, `-mt-monti-4`). */
export const Spacing: Story = {
	render: () => (
		<Stack gap="normal">
			{tokens.spacing.tokens.map(({ name, value, usage }: Named & { value: string }) => {
				const step = name.replace("space-", "");
				return (
					<Stack key={name} direction="row" gap="spacious" align="center">
						<Text variant="label" mono className="w-24 shrink-0">
							monti-{step}
						</Text>
						<div className="h-4 rounded-monti-sm bg-monti-emphasis" style={{ width: px(name) }} />
						<Text variant="caption" tone="muted">
							{value} · {usage}
						</Text>
					</Stack>
				);
			})}
		</Stack>
	),
};

/** Corner radius, and the three shadows: floating menus, dialogs, sheets. Resting surfaces are flat, with a border only. */
export const RadiusAndShadow: Story = {
	render: () => (
		<Stack gap="spacious">
			<Group title="Radius (rounded-monti-*)">
				{tokens.radius.tokens.map(({ name, value, usage }) => (
					<Stack key={name} gap="tight" className="w-40">
						<div className="h-12 border border-monti-emphasis bg-monti-muted" style={{ borderRadius: px(name) }} />
						<Text variant="meta">
							rounded-monti-{name.replace("radius-", "")} · {value}
						</Text>
						<Text variant="note" tone="muted">
							{usage}
						</Text>
					</Stack>
				))}
			</Group>
			<Group title="Shadow (shadow-monti-*)">
				{tokens.shadow.tokens.map(({ name, usage }) => (
					<Stack key={name} gap="tight" className="w-48">
						<div
							className="h-16 rounded-monti-lg border border-monti-emphasis bg-monti-page"
							style={{ boxShadow: px(name) }}
						/>
						<Text variant="meta">{classOf(name)}</Text>
						<Text variant="note" tone="muted">
							{usage}
						</Text>
					</Stack>
				))}
			</Group>
		</Stack>
	),
};

/** Heights of controls and bars, widths of columns, panels and sheets, and icon sizes. */
export const Sizes: Story = {
	render: () => (
		<Stack gap="spacious">
			<Group title="Height (h-monti-*)">
				{tokens.height.tokens.map(({ name, value, usage }) => (
					<Stack key={name} gap="tight" className="w-40">
						<div className="rounded-monti-sm bg-monti-muted" style={{ height: px(name) }} />
						<Text variant="meta">
							{name} · {value}
						</Text>
						<Text variant="note" tone="muted">
							{usage}
						</Text>
					</Stack>
				))}
			</Group>
			<Stack gap="normal">
				<Text variant="title">Width (w-monti-*, max-w-monti-*)</Text>
				{tokens.width.tokens.map(({ name, value, usage }) => (
					<Stack key={name} gap="hair">
						<div className="h-3 rounded-monti-sm bg-monti-muted" style={{ width: px(name) }} />
						<Text variant="meta">
							{classOf(name)} · {value}
						</Text>
						<Text variant="note" tone="muted">
							{usage}
						</Text>
					</Stack>
				))}
			</Stack>
			<Group title="Icon size (size-monti-icon-*)">
				{tokens.size.tokens.map(({ name, value, usage }) => (
					<Stack key={name} gap="tight" className="w-40">
						<div className="rounded-monti-sm bg-monti-emphasis" style={{ width: px(name), height: px(name) }} />
						<Text variant="meta">
							{name} · {value}
						</Text>
						<Text variant="note" tone="muted">
							{usage}
						</Text>
					</Stack>
				))}
			</Group>
		</Stack>
	),
};
