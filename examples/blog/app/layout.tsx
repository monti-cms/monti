import type { ReactNode } from "react";

export const metadata = { title: "Monti 블로그" };

// The whole app's frame: the site's pages and the admin's page both sit in it, so it carries no styles of the site's (see `(site)/layout.tsx`).
export default function Layout({ children }: { children: ReactNode }) {
	return (
		<html lang="ko">
			<body>{children}</body>
		</html>
	);
}
