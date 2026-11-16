import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { userEvent } from "storybook/test";
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
import { StoryCaption } from "./story-caption";

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
	tags: ["visual"],
	render: () => (
		<Stack className="max-w-sm" gap={16}>
			<StoryCaption>placeholder</StoryCaption>
			<Combobox items={TAGS}>
				<ComboboxInput placeholder="태그 고르기" />
				<Popup />
			</Combobox>
			<StoryCaption>filled, with clear button</StoryCaption>
			<Combobox items={TAGS} defaultValue="개발 노트">
				<ComboboxInput showClear />
				<Popup />
			</Combobox>
			<StoryCaption>no trigger button</StoryCaption>
			<Combobox items={TAGS}>
				<ComboboxInput placeholder="태그 검색" showTrigger={false} />
				<Popup />
			</Combobox>
			<StoryCaption>disabled</StoryCaption>
			<Combobox items={TAGS} defaultValue="일상">
				<ComboboxInput disabled />
				<Popup />
			</Combobox>
			<StoryCaption>readOnly (a value to read: full ink, no caret and no clear, its list does not open)</StoryCaption>
			<Combobox items={TAGS} value="일상" readOnly>
				<ComboboxInput showClear />
				<Popup />
			</Combobox>
			<StoryCaption>invalid</StoryCaption>
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

function ChipsExample({
	open,
	invalid,
	proposal,
	disabled,
	readOnly,
}: {
	open?: boolean;
	invalid?: boolean;
	proposal?: boolean;
	disabled?: boolean;
	readOnly?: boolean;
}) {
	const anchor = useComboboxAnchor();
	const [value, setValue] = useState<string[]>(["공지사항", "리뷰"]);
	return (
		<Combobox
			items={TAGS}
			multiple
			defaultOpen={open}
			value={value}
			onValueChange={setValue}
			disabled={disabled}
			readOnly={readOnly}
		>
			<ComboboxChips ref={anchor} proposal={proposal}>
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

/**
 * Multiple selection as chips: closed, invalid, with values the assistant proposed, off (the field dimmed once, chips and all), and read-only
 * (full ink, no × on a chip; the keyboard's focus is a ring around the field).
 */
export const Chips: Story = {
	tags: ["visual"],
	render: () => (
		<Stack className="max-w-sm" gap={16}>
			<StoryCaption>closed</StoryCaption>
			<ChipsExample />
			<StoryCaption>invalid</StoryCaption>
			<ChipsExample invalid />
			<StoryCaption>proposal (values the assistant chose and nobody has touched)</StoryCaption>
			<ChipsExample proposal />
			<StoryCaption>disabled</StoryCaption>
			<ChipsExample disabled />
			<StoryCaption>readOnly</StoryCaption>
			<ChipsExample readOnly />
		</Stack>
	),
};

/** A read-only field of many with the keyboard on it: nothing is typed, so no caret shows the focus; a ring around the field does. */
export const ChipsReadOnlyFocused: Story = {
	tags: ["visual"],
	render: () => (
		<Stack className="max-w-sm" gap={16}>
			<ChipsExample readOnly />
		</Stack>
	),
	play: async () => {
		await userEvent.tab();
	},
};

export const ChipsOpen: Story = {
	render: () => (
		<Stack className="min-h-72 max-w-sm">
			<ChipsExample open />
		</Stack>
	),
};
