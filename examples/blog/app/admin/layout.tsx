import type { ReactNode } from "react";
import "../../monti/blocks/blocks.css";

export const metadata = { title: "Monti" };

// The admin's own frame: nothing of the site's styles is loaded here.
export default function Layout({ children }: { children: ReactNode }) {
	return (
		<html lang="ko">
			<body>{children}</body>
		</html>
	);
}
