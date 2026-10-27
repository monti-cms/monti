import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	useComboboxAnchor,
} from "./combobox";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Controls/Field/Combobox",
	component: Combobox,
} satisfies Meta<typeof Combobox>;
export default meta;
type Story = StoryObj<typeof meta>;

const TAGS = ["공지사항", "개발 노트", "일상", "리뷰", "튜토리얼"];

function Popup() {
	return (
		<ComboboxContent>
			<ComboboxEmpty>맞는 태그가 없어요</ComboboxEmpty>
			<ComboboxList>
				{(tag: string) => (
					<ComboboxItem key={tag} value={tag}>
						{tag}
					</ComboboxItem>
				)}
			</ComboboxList>
		</ComboboxContent>
	);
}

export const Playground: Story = {
	render: () => (
		<Stack className="max-w-sm">
			<Combobox items={TAGS}>
				<ComboboxInput placeholder="태그 고르기" />
				<Popup />
			</Combobox>
		</Stack>
	),
};

export const States: Story = {
	render: () => (
		<Stack className="max-w-sm" gap={16}>
			<Text variant="caption" tone="muted">
				placeholder
			</Text>
			<Combobox items={TAGS}>
				<ComboboxInput placeholder="태그 고르기" />
				<Popup />
			</Combobox>
			<Text variant="caption" tone="muted">
				filled, with clear button
			</Text>
			<Combobox items={TAGS} defaultValue="개발 노트">
				<ComboboxInput showClear />
				<Popup />
			</Combobox>
			<Text variant="caption" tone="muted">
				no trigger button
			</Text>
			<Combobox items={TAGS}>
				<ComboboxInput placeholder="태그 검색" showTrigger={false} />
				<Popup />
			</Combobox>
			<Text variant="caption" tone="muted">
				disabled
			</Text>
			<Combobox items={TAGS} defaultValue="일상">
				<ComboboxInput disabled />
				<Popup />
			</Combobox>
			<Text variant="caption" tone="muted">
				invalid
			</Text>
			<Combobox items={TAGS}>
				<ComboboxInput aria-invalid placeholder="태그 고르기" />
				<Popup />
			</Combobox>
		</Stack>
	),
};

/** The list open, with a selected item. */
export const Open: Story = {
	render: () => (
		<Stack className="min-h-72 max-w-sm">
			<Combobox items={TAGS} defaultOpen defaultValue="리뷰">
				<ComboboxInput />
				<Popup />
			</Combobox>
		</Stack>
	),
};

/** The list open and filtered to nothing. */
export const Empty: Story = {
	render: () => (
		<Stack className="min-h-40 max-w-sm">
			<Combobox items={TAGS} defaultOpen defaultInputValue="없는 태그">
				<ComboboxInput />
				<Popup />
			</Combobox>
		</Stack>
	),
};

function ChipsExample({ open, invalid }: { open?: boolean; invalid?: boolean }) {
	const anchor = useComboboxAnchor();
	const [value, setValue] = useState<string[]>(["공지사항", "리뷰"]);
	return (
		<Combobox items={TAGS} multiple defaultOpen={open} value={value} onValueChange={setValue}>
			<ComboboxChips ref={anchor}>
				{value.map((tag) => (
					<ComboboxChip key={tag}>{tag}</ComboboxChip>
				))}
				<ComboboxChipsInput aria-invalid={invalid} placeholder="태그 추가" />
			</ComboboxChips>
			<ComboboxContent anchor={anchor}>
				<ComboboxEmpty>맞는 태그가 없어요</ComboboxEmpty>
				<ComboboxList>
					{(tag: string) => (
						<ComboboxItem key={tag} value={tag}>
							{tag}
						</ComboboxItem>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}

/** Multiple selection as chips, closed, open and invalid. */
export const Chips: Story = {
	render: () => (
		<Stack className="max-w-sm" gap={16}>
			<ChipsExample />
			<ChipsExample invalid />
		</Stack>
	),
};

export const ChipsOpen: Story = {
	render: () => (
		<Stack className="min-h-72 max-w-sm">
			<ChipsExample open />
		</Stack>
	),
};
