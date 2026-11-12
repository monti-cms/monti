import { draftMode } from "next/headers";

/**
 * One line at the foot of the window while a preview is open: it says so, and "exit" ends it (doc 16). The site puts it in its layout; the preview
 * works without it. It carries its own looks and takes nothing from the site's styles or the admin's.
 */
export async function PreviewBar({
	admin = "/admin",
	labels = { preview: "Preview", exit: "Exit" },
}: {
	/** Where the admin page is: its API ends the preview. */
	admin?: string;
	/** The line's two words, in the site's language. */
	labels?: { preview: string; exit: string };
}) {
	if (!(await draftMode()).isEnabled) return null;
	return (
		<div
			data-monti-preview=""
			style={{
				position: "fixed",
				insetInline: 0,
				bottom: 16,
				zIndex: 2147483647,
				display: "flex",
				justifyContent: "center",
				pointerEvents: "none",
				font: "500 13px/20px system-ui, sans-serif",
			}}
		>
			<div
				style={{
					pointerEvents: "auto",
					display: "flex",
					alignItems: "center",
					gap: 12,
					padding: "6px 14px",
					borderRadius: 999,
					background: "#1c1b19",
					color: "#faf9f5",
					boxShadow: "0 12px 32px rgba(40, 32, 20, 0.14)",
				}}
			>
				<span>{labels.preview}</span>
				{/* A plain link, never prefetched: following it ends the preview. */}
				<a
					href={`${admin.replace(/\/$/, "")}/api/preview/exit`}
					style={{ color: "inherit", textDecoration: "underline" }}
				>
					{labels.exit}
				</a>
			</div>
		</div>
	);
}
