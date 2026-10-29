import { Document } from "@carbon/icons-react";
import { cn } from "./cn";

/**
 * What a `Tile` shows for a file that has no picture to show (PDF, CSV, ZIP, text): a 20px file icon in the middle and the extension under it in mono
 * 11. It takes the tile's ground and goes fainter when the tile failed. Use it as the tile's `preview`.
 */
function FilePreview({
	ext,
	framed = false,
	className,
}: {
	ext: string;
	/** Draws its own 4:3 box with rounded corners and the neutral fill, for use outside a tile (a panel's preview). */
	framed?: boolean;
	className?: string;
}) {
	return (
		<span
			data-slot="file-preview"
			// Decorative: the file's name already says what it is, so a tile's name does not start with its extension.
			aria-hidden
			className={cn(
				"flex size-full flex-col items-center justify-center gap-monti-6 text-monti-subtle group-data-[status=failed]/tile:text-monti-faint",
				framed && "aspect-[4/3] w-full rounded-monti-md bg-monti-muted",
				className,
			)}
		>
			<Document aria-hidden className="size-5" />
			<span className="text-monti-micro">{ext}</span>
		</span>
	);
}

export { FilePreview };
