import type { ReactNode } from "react";

export const metadata = { title: "Monti showcase" };

// The admin's own frame: nothing of the site's styles is loaded here.
export default function Layout({ children }: { children: ReactNode }) {
	return (
		<html lang="ko">
			<body>{children}</body>
		</html>
	);
}
