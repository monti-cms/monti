"use client";

import type * as React from "react";
import { cn } from "./cn";
import { CutWords } from "./cut-words";
import { FIELD_ACTION, FIELD_ACTION_BUTTON, FIELD_HOVER, FIELD_INSET } from "./hover";
import { IconButton, IconButtonContext } from "./icon-button";
import { Attachment, Close, Image as ImageIcon } from "./icons";
import { Image } from "./image";
import { useProposalDescription } from "./proposal-cue";

const HEIGHT = { sm: "h-monti-control-sm", md: "h-monti-control-md", default: "h-monti-control-md" } as const;

/**
 * A media field (a cover image, a file) drawn like every other field: an underline, the chosen file's name after a small thumbnail, or the faint
 * placeholder while empty. Pressing the line opens the media picker (`onOpen`); the × at the end takes the file out (`onClear`). The picture itself is
 * not shown here: the field reads like its neighbours, an input or a select.
 *
 * `readOnly` (an archived entry, one in the trash) is the value to read, with nothing that changes it: the line is not a button, the pointer stays an
 * arrow, the ground does not answer it, and there is no × and no picture icon that says "choose one". The `action` stays: it is the caller's, and read-only
 * it is a way to read (a picture's settings card with its fields read-only). The field is then a group, named with `aria-labelledby` (the label's id): a
 * label's `htmlFor` names only what can be pressed or typed in.
 */
function MediaInput({
	id,
	size = "default",
	value,
	placeholder,
	accept = "image",
	onOpen,
	onClear,
	clearLabel,
	proposal = false,
	following = false,
	readOnly = false,
	action,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "children"> & {
	/** For the label's `htmlFor`: it names the button that opens the picker. */
	id?: string;
	size?: keyof typeof HEIGHT;
	/** The chosen file: its name, and a thumbnail when it is an image. */
	value?: { name: string; thumbnail?: string | null } | null;
	placeholder?: string;
	/** What the field takes: a picture (its mark is a picture's) or any file (an attachment's mark). Decided here, once. */
	accept?: "image" | "any";
	onOpen?: () => void;
	onClear?: () => void;
	/** The name of the × that takes the file out. */
	clearLabel?: string;
	/** The assistant chose this file and nobody has touched it yet. */
	proposal?: boolean;
	/** The file is another value's, shown here because this one follows it (a translation following its source): it reads faint, and there is nothing to take out. */
	following?: boolean;
	/** The value cannot be changed here: it is read, not pressed. */
	readOnly?: boolean;
	/** A control of the file's own before the × (a picture's settings). Its icon buttons take the × 's size. */
	action?: React.ReactNode;
}) {
	const description = useProposalDescription(proposal);
	const actionSize = FIELD_ACTION_BUTTON[size === "default" ? "md" : size];
	const line = cn(
		"flex h-full min-w-0 grow items-center gap-monti-8 border-0 bg-transparent p-0 text-left outline-none",
		size === "sm" ? "text-monti-note" : "text-monti-body",
		value && !following ? (proposal ? "text-monti-proposal" : "text-monti-default") : "text-monti-faint",
	);
	const shown = value ? (
		<>
			{/* The frame that waits for its picture; with no picture (a file) it is the same empty square, so names line up. */}
			<Image src={value.thumbnail} alt="" size="thumb-sm" radius="sm" />
			<CutWords className="truncate">{value.name}</CutWords>
		</>
	) : (
		<CutWords className="truncate">{placeholder}</CutWords>
	);
	return (
		<div
			data-slot="media-input"
			data-size={size}
			data-proposal={proposal || undefined}
			data-readonly={readOnly || undefined}
			role={readOnly ? "group" : undefined}
			className={cn(
				!readOnly && FIELD_HOVER,
				"flex w-full min-w-0 items-center border-transparent border-b transition-colors focus-within:border-monti-contrast data-proposal:border-monti-proposal data-proposal:border-b-[1.5px]",
				// A proposal's blue line stays under the keyboard's focus (a state's colour is not taken away), so the focus on the file's name is a
				// ring around the whole field, outside the line, as a select's is. The × at the end has its own ring.
				"data-proposal:has-[>button:focus-visible]:ring-2 data-proposal:has-[>button:focus-visible]:ring-monti-contrast/60",
				FIELD_INSET,
				HEIGHT[size],
				className,
			)}
			{...props}
		>
			{readOnly ? (
				<div id={id} aria-description={description} className={line}>
					{shown}
				</div>
			) : (
				<button
					id={id}
					type="button"
					aria-description={description}
					onClick={onOpen}
					className={cn(line, "cursor-pointer")}
				>
					{shown}
				</button>
			)}
			<span className={cn(FIELD_ACTION, "flex items-center")}>
				{action && <IconButtonContext value={actionSize}>{action}</IconButtonContext>}
				{readOnly ? null : value && onClear ? (
					<IconButton {...actionSize} label={clearLabel ?? ""} onClick={onClear}>
						<Close />
					</IconButton>
				) : action ? null : (
					<span aria-hidden className="mr-monti-6 flex text-monti-faint [&>svg]:size-4">
						{accept === "any" ? <Attachment /> : <ImageIcon />}
					</span>
				)}
			</span>
		</div>
	);
}

export { MediaInput };
