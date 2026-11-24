import { cn } from "./cn";
import { Document } from "./icons";

/**
 * What a `Tile` shows for a file that has no picture to show (PDF, CSV, ZIP, text): a 20px file icon in the middle and the extension under it in mono
 * 11. It takes the tile's ground and goes fainter when the tile failed. Use it as the tile's `preview`.
 */
function FilePreview({
	ext,
	framed = false,
	className,
}: {
	/** The extension under the icon; without it the icon alone, 16px and faint (a tile whose detail line already names the kind). */
	ext?: string;
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
				"flex flex-col items-center justify-center gap-monti-6 text-monti-subtle group-data-[status=failed]/tile:text-monti-faint",
				// Framed, it is as tall as a picture's frame (4:3), not as tall as the box it is in.
				framed ? "aspect-[4/3] w-full rounded-monti-md bg-monti-muted" : "size-full",
				className,
			)}
		>
			<Document aria-hidden className={ext ? "size-5" : "size-4 text-monti-faint"} />
			{ext && <span className="font-mono text-monti-micro">{ext}</span>}
		</span>
	);
}

export { FilePreview };
