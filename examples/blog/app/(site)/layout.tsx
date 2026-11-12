import { PreviewBar } from "@monti-cms/next";
import type { ReactNode } from "react";
import "../site.css";

// The site's own frame: its styles, under `.site`, and the preview's line. The admin's page is outside it.
export default function SiteLayout({ children }: { children: ReactNode }) {
	return (
		<>
			<main className="site">{children}</main>
			{/* One line while a preview is open, with the way out of it. */}
			<PreviewBar labels={{ preview: "미리보기", exit: "끝내기" }} />
		</>
	);
}
