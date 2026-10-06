import type { ReactNode } from "react";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className="bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">{children}</body>
		</html>
	);
}
