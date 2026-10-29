import { cn } from "./cn";
import { Progress } from "./progress";

/**
 * An image that is still going up, in its place in the body: the picture the person gave, faded under the page ground, 240px high, with the 3px
 * progress bar along its bottom edge. It becomes the real image when the upload ends.
 */
function UploadingImage({
	src,
	progress,
	label,
	className,
}: {
	/** The local picture (the file the person pasted or dropped). */
	src?: string | null;
	/** How far the upload is, 0–100. */
	progress: number;
	/** The name of the bar, for screen readers. */
	label: string;
	className?: string;
}) {
	return (
		<span
			data-slot="uploading-image"
			className={cn("relative block h-60 overflow-hidden rounded-monti-md bg-monti-muted", className)}
		>
			{src && <img src={src} alt="" className="size-full object-cover" />}
			<span aria-hidden className="absolute inset-0 bg-monti-page opacity-45" />
			<Progress value={progress} label={label} className="absolute inset-x-0 bottom-0" />
		</span>
	);
}

export { UploadingImage };
