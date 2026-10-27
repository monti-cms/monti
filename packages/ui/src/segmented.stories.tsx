import type { Meta, StoryObj } from "@storybook/react-vite";
import { LayoutGrid, List } from "lucide-react";
import { useState } from "react";
import { Segmented } from "./segmented";
import { Stack } from "./stack";

/** A short choice of one among a few. The picked cell is on the selected background at 600. */
const meta = { title: "Controls/Choice/Segmented", component: Segmented } satisfies Meta<typeof Segmented>;
export default meta;
type Story = StoryObj<typeof meta>;

const MODES = [
	{ value: "same", label: "모두 같음" },
	{ value: "each", label: "언어마다" },
	{ value: "source", label: "원문 따름" },
] as const;

function Demo({ size, inline }: { size?: "md" | "sm"; inline?: boolean }) {
	const [value, setValue] = useState<(typeof MODES)[number]["value"]>("same");
	return (
		<Segmented
			aria-label="언어 설정"
			value={value}
			onValueChange={setValue}
			options={MODES}
			size={size}
			inline={inline}
		/>
	);
}

export const Playground: Story = {
	args: { value: "same", onValueChange: () => {}, options: MODES },
	render: () => (
		<Stack className="max-w-sm">
			<Demo />
		</Stack>
	),
};

/** A sort direction before any column is sorted: `value={null}` picks none, and the first press picks one. */
export const NothingPicked: Story = {
	args: { value: null, onValueChange: () => {}, options: MODES },
	render: () => (
		<Stack className="max-w-sm">
			<Segmented
				aria-label="정렬"
				size="sm"
				value={null}
				onValueChange={() => {}}
				options={[
					{ value: "asc", label: "오름차순" },
					{ value: "desc", label: "내림차순" },
				]}
			/>
		</Stack>
	),
};

/** Full width, small, inline (as wide as its cells), icons only, disabled. */
export const Variants: Story = {
	args: { value: "same", onValueChange: () => {}, options: MODES },
	render: () => (
		<Stack gap={16} className="max-w-sm">
			<Demo />
			<Demo size="sm" />
			<Demo inline />
			<Demo size="sm" inline />
			<Segmented
				aria-label="보기"
				value="grid"
				onValueChange={() => {}}
				inline
				options={[
					{ value: "grid", label: <LayoutGrid aria-hidden className="size-4" />, "aria-label": "격자" },
					{ value: "list", label: <List aria-hidden className="size-4" />, "aria-label": "목록" },
				]}
			/>
			<Segmented aria-label="비활성" value="same" onValueChange={() => {}} options={MODES} disabled />
		</Stack>
	),
};
