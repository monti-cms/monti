import type { Meta, StoryObj } from "@storybook/react-vite";
import { Marker, Untranslated } from "./marker";
import { Stack } from "./stack";
import { Text } from "./text";

/**
 * Translation in the editor. A block not decided yet is dimmed (`Untranslated`); a small `Marker` in the left margin says what a block is: its
 * source changed, it is new, it was removed, or it stays in the source language.
 */
const meta = { title: "Translation/Marks", component: Marker, args: { children: "바뀜" } } satisfies Meta<
	typeof Marker
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = { args: { tone: "changed" } };

/** The three tones, and a note for the assistant (a count, a dot-dot-dot while it works). */
export const Tones: Story = {
	render: () => (
		<Stack direction="row" gap={12} align="center">
			<Marker tone="changed">바뀜</Marker>
			<Marker tone="changed">새로</Marker>
			<Marker tone="changed">지워짐</Marker>
			<Marker tone="keep">원문</Marker>
			<Marker tone="request">1</Marker>
			<Marker tone="request">…</Marker>
		</Stack>
	),
};

/** A marker with a press handler is a button; `active` is its card being open. */
export const Active: Story = {
	render: () => (
		<Stack direction="row" gap={12} align="center">
			<Marker tone="changed" onClick={() => undefined}>
				바뀜
			</Marker>
			<Marker tone="changed" active onClick={() => undefined}>
				바뀜
			</Marker>
			<Marker tone="request" onClick={() => undefined}>
				2
			</Marker>
			<Marker tone="request" active onClick={() => undefined}>
				2
			</Marker>
		</Stack>
	),
};

/** Blocks of a translation: decided, not decided (dimmed), kept in the source, source changed, source removed. */
export const InBlocks: Story = {
	render: () => (
		<Stack gap={16} className="max-w-lg pl-20">
			<Text as="p" variant="reading">
				The list keeps only the title and the address.
			</Text>
			<Text as="p" variant="reading">
				<Untranslated>편집기도 같은 원칙으로 정리했다.</Untranslated>
			</Text>
			<div className="relative">
				<Marker tone="keep" margin>
					원문
				</Marker>
				<Text as="p" variant="reading">
					글은 도구보다 오래 남는다.
				</Text>
			</div>
			<div className="relative">
				<Marker tone="changed" margin onClick={() => undefined}>
					바뀜
				</Marker>
				<Text as="p" variant="reading">
					The rest I open only when I need it.
				</Text>
			</div>
			<div className="relative">
				<Marker tone="changed" margin>
					지워짐
				</Marker>
				<Text as="p" variant="reading">
					The editor follows the same rule.
				</Text>
			</div>
		</Stack>
	),
};
