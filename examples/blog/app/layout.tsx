import { PreviewBar } from "@monti-cms/next";
import type { ReactNode } from "react";
import "./site.css";

export const metadata = { title: "Monti 블로그" };

export default function Layout({ children }: { children: ReactNode }) {
	return (
		<html lang="ko">
			<body>
				{children}
				{/* One line while a preview is open, with the way out of it. */}
				<PreviewBar />
			</body>
		</html>
	);
}
