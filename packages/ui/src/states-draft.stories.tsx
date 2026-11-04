import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { Button } from "./button";
import { Chip } from "./chip";
import { FilterButton } from "./filter-button";
import { IconButton } from "./icon-button";
import { Settings } from "./icons";
import { StoryCaption } from "./story-caption";
import { TagInput } from "./tag-input";
import { TextButton } from "./text-button";

/**
 * A draft for the owner, not a rule yet: the pressed state of everything that is pressed, and the states of a chip. Each cell is drawn in its state
 * with classes set here (no pointer needed); the parts do not have these looks until the draft is approved. The rule it proposes: pressing takes one
 * step darker than the pointer does (hover `bg-muted` → pressed `bg-selected`, hover `bg-selected` → pressed `bg-current`, a dark pill 90% → 80%).
 */
const meta = { title: "Foundations/States draft" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const STATES = ["기본", "hover", "포커스", "누름 (제안)", "비활성"] as const;
type State = (typeof STATES)[number];

/** The tint of a text button, drawn as its hover draws it, in `bg-muted` (hover) or `bg-selected` (pressed). Written out whole so Tailwind finds them. */
const TINT = {
	muted:
		"bg-monti-muted text-monti-default shadow-[-4px_0_0_4px_var(--monti-bg-muted),4px_0_0_4px_var(--monti-bg-muted)]",
	selected:
		"bg-monti-selected text-monti-default shadow-[-4px_0_0_4px_var(--monti-bg-selected),4px_0_0_4px_var(--monti-bg-selected)]",
};
const tint = (color: keyof typeof TINT) => TINT[color];
const FOCUS_RING = "ring-3 ring-monti-contrast/20";
const TEXT_FOCUS =
	"shadow-[-4px_0_0_4px_var(--monti-bg-page),4px_0_0_4px_var(--monti-bg-page),-4px_0_0_6px_var(--monti-border-strong),4px_0_0_6px_var(--monti-border-strong)]";

function Row({ name, children }: { name: string; children: (state: State) => ReactNode }) {
	return (
		<tr>
			<th className="py-monti-12 pr-monti-16 text-left align-middle font-normal">
				<StoryCaption>{name}</StoryCaption>
			</th>
			{STATES.map((state) => (
				<td key={state} className="px-monti-12 py-monti-12 align-middle">
					{children(state)}
				</td>
			))}
		</tr>
	);
}

function Sheet({ children }: { children: ReactNode }) {
	return (
		<table className="w-full table-fixed border-collapse">
			<colgroup>
				<col className="w-40" />
			</colgroup>
			<thead>
				<tr>
					<th />
					{STATES.map((state) => (
						<th key={state} className="px-monti-12 pb-monti-8 text-left font-normal">
							<StoryCaption>{state}</StoryCaption>
						</th>
					))}
				</tr>
			</thead>
			<tbody>{children}</tbody>
		</table>
	);
}

/** Pressed: one step darker than the pointer's tint, for as long as it is held down. */
export const Pressed: Story = {
	render: () => (
		<Sheet>
			<Row name="Button 주">
				{(state) => (
					<Button
						disabled={state === "비활성"}
						className={
							state === "hover"
								? "bg-monti-emphasis/90"
								: state === "포커스"
									? FOCUS_RING
									: state === "누름 (제안)"
										? "bg-monti-emphasis/80"
										: undefined
						}
					>
						저장
					</Button>
				)}
			</Row>
			<Row name="Button 보조">
				{(state) => (
					<Button
						variant="secondary"
						disabled={state === "비활성"}
						className={
							state === "hover"
								? "bg-monti-selected"
								: state === "포커스"
									? FOCUS_RING
									: state === "누름 (제안)"
										? "bg-monti-current text-monti-default"
										: undefined
						}
					>
						미리보기
					</Button>
				)}
			</Row>
			<Row name="IconButton">
				{(state) => (
					<IconButton
						label="설정"
						disabled={state === "비활성"}
						className={
							state === "hover"
								? "bg-monti-selected text-monti-default"
								: state === "포커스"
									? FOCUS_RING
									: state === "누름 (제안)"
										? "bg-monti-current text-monti-default"
										: undefined
						}
					>
						<Settings />
					</IconButton>
				)}
			</Row>
			<Row name="TextButton">
				{(state) => (
					<TextButton
						disabled={state === "비활성"}
						className={
							state === "hover"
								? tint("muted")
								: state === "포커스"
									? TEXT_FOCUS
									: state === "누름 (제안)"
										? tint("selected")
										: undefined
						}
					>
						되돌리기
					</TextButton>
				)}
			</Row>
			<Row name="TextButton 밑줄">
				{(state) => (
					<TextButton
						variant="underline"
						disabled={state === "비활성"}
						className={
							state === "hover"
								? tint("muted")
								: state === "포커스"
									? TEXT_FOCUS
									: state === "누름 (제안)"
										? tint("selected")
										: undefined
						}
					>
						편집
					</TextButton>
				)}
			</Row>
			<Row name="FilterButton">
				{(state) => (
					<FilterButton
						disabled={state === "비활성"}
						className={
							state === "hover"
								? tint("muted")
								: state === "포커스"
									? TEXT_FOCUS
									: state === "누름 (제안)"
										? tint("selected")
										: undefined
						}
					>
						태그
					</FilterButton>
				)}
			</Row>
		</Sheet>
	),
};

/** The chip's ×. Hover: the × turns ink on a round tint one step over the chip. Focus: the ring around the ×. Pressed: a step darker still. Off: faint and
 * not pressable. The chip itself is not a button, so only its × answers; a chip that opens something would answer as a whole, like a pill. */
const CHIP_X = {
	hover: "[&>button]:rounded-monti-full [&>button]:bg-monti-current [&>button]:text-monti-default",
	focus: "[&>button]:rounded-monti-full [&>button]:ring-2 [&>button]:ring-monti-contrast/30",
	pressed: "[&>button]:rounded-monti-full [&>button]:bg-monti-emphasis/15 [&>button]:text-monti-default",
};

export const ChipStates: Story = {
	name: "Chip",
	render: () => (
		<Sheet>
			<Row name="Chip ×">
				{(state) => (
					<Chip
						onRemove={() => {}}
						removeLabel="빼기"
						className={
							state === "hover"
								? CHIP_X.hover
								: state === "포커스"
									? CHIP_X.focus
									: state === "누름 (제안)"
										? CHIP_X.pressed
										: state === "비활성"
											? "opacity-45 [&>button]:cursor-not-allowed"
											: undefined
						}
					>
						상태: 발행됨
					</Chip>
				)}
			</Row>
			<Row name="Chip × 작은 (필드 안)">
				{(state) => (
					<Chip
						size="sm"
						onRemove={() => {}}
						removeLabel="빼기"
						className={
							state === "hover"
								? CHIP_X.hover
								: state === "포커스"
									? CHIP_X.focus
									: state === "누름 (제안)"
										? CHIP_X.pressed
										: state === "비활성"
											? "opacity-45 [&>button]:cursor-not-allowed"
											: undefined
						}
					>
						가을
					</Chip>
				)}
			</Row>
			<Row name="TagInput (칩 위 hover)">
				{(state) =>
					state === "hover" ? (
						<TagInput
							items={["가을", "산"]}
							onChange={() => {}}
							removeLabel={(item) => `${item} 빼기`}
							aria-label="태그"
							className="[&>[data-slot=chip]:first-child>button]:rounded-monti-full [&>[data-slot=chip]:first-child>button]:bg-monti-current [&>[data-slot=chip]:first-child>button]:text-monti-default"
						/>
					) : state === "기본" ? (
						<TagInput
							items={["가을", "산"]}
							onChange={() => {}}
							removeLabel={(item) => `${item} 빼기`}
							aria-label="태그"
						/>
					) : null
				}
			</Row>
		</Sheet>
	),
};
