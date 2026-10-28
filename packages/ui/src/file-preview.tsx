import { Document } from "@carbon/icons-react";
import { cn } from "./cn";

/**
 * What a file that is not a picture shows in a tile's preview (`.mt-tile .img.is-file`): a 20px file icon with its extension under it in mono, centered on
 * the neutral fill. It fills the preview box of a `Tile`; a failed file shows it fainter.
 */
function FilePreview({ extension, faint = false }: { extension: string; faint?: boolean }) {
	return (
		<span
			data-slot="file-preview"
			className={cn(
				"flex size-full flex-col items-center justify-center gap-monti-6 bg-monti-muted text-monti-subtle",
				faint && "text-monti-faint",
			)}
		>
			<Document aria-hidden className="size-5" />
			<span className="font-mono text-[11px] leading-[14px] tracking-[0.04em]">{extension.toUpperCase()}</span>
		</span>
	);
}

export { FilePreview };
