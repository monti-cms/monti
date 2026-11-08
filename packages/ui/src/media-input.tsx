"use client";

import type * as React from "react";
import { cn } from "./cn";
import { FIELD_ACTION, FIELD_ACTION_BUTTON, FIELD_HOVER, FIELD_INSET } from "./hover";
import { IconButton } from "./icon-button";
import { Close, Image as ImageIcon } from "./icons";
import { useProposalDescription } from "./proposal-cue";

const HEIGHT = { sm: "h-monti-control-sm", md: "h-monti-control-md", default: "h-monti-control-lg" } as const;

/**
 * A media field (a cover image, a file) drawn like every other field: an underline, the chosen file's name after a small thumbnail, or the faint
 * placeholder while empty. Pressing the line opens the media picker (`onOpen`); the × at the end takes the file out (`onClear`). The picture itself is
 * not shown here: the field reads like its neighbours, an input or a select.
 */
function MediaInput({
	id,
	size = "default",
	value,
	placeholder,
	onOpen,
	onClear,
	clearLabel,
	proposal = false,
	following = false,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "children"> & {
	/** For the label's `htmlFor`: it names the button that opens the picker. */
	id?: string;
	size?: keyof typeof HEIGHT;
	/** The chosen file: its name, and a thumbnail when it is an image. */
	value?: { name: string; thumbnail?: string | null } | null;
	placeholder?: string;
	onOpen?: () => void;
	onClear?: () => void;
	/** The name of the × that takes the file out. */
	clearLabel?: string;
	/** The assistant chose this file and nobody has touched it yet. */
	proposal?: boolean;
	/** The file is another value's, shown here because this one follows it (a translation following its source): it reads faint, and there is nothing to take out. */
	following?: boolean;
}) {
	const description = useProposalDescription(proposal);
	return (
		<div
			data-slot="media-input"
			data-size={size}
			data-proposal={proposal || undefined}
			className={cn(
				FIELD_HOVER,
				"flex w-full min-w-0 items-center border-monti-default border-b transition-colors focus-within:border-monti-contrast data-proposal:border-monti-proposal data-proposal:border-b-[1.5px]",
				FIELD_INSET,
				HEIGHT[size],
				className,
			)}
			{...props}
		>
			<button
				id={id}
				type="button"
				aria-description={description}
				onClick={onOpen}
				className={cn(
					"flex h-full min-w-0 grow cursor-pointer items-center gap-monti-8 border-0 bg-transparent p-0 text-left outline-none",
					size === "sm" ? "text-monti-note" : "text-monti-body",
					value && !following ? (proposal ? "text-monti-proposal" : "text-monti-default") : "text-monti-faint",
				)}
			>
				{value ? (
					<>
						{value.thumbnail ? (
							<img
								src={value.thumbnail}
								alt=""
								className="size-5 shrink-0 rounded-monti-sm bg-monti-muted object-cover"
							/>
						) : (
							<span className="size-5 shrink-0 rounded-monti-sm bg-monti-muted" aria-hidden />
						)}
						<span className="truncate">{value.name}</span>
					</>
				) : (
					<span className="truncate">{placeholder}</span>
				)}
			</button>
			<span className={FIELD_ACTION}>
				{value && onClear ? (
					<IconButton
						{...FIELD_ACTION_BUTTON[size === "default" ? "lg" : size]}
						label={clearLabel ?? ""}
						onClick={onClear}
					>
						<Close />
					</IconButton>
				) : (
					<ImageIcon aria-hidden className="mr-monti-6 size-4 text-monti-faint" />
				)}
			</span>
		</div>
	);
}

export { MediaInput };
