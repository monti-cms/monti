"use client";

import { useState } from "react";

/** Code copy button. After copying, it briefly shows `copiedLabel`. */
export function CmsCopyButton({ text, label, copiedLabel }: { text: string; label: string; copiedLabel: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<button
			type="button"
			className="cms-code-copy"
			aria-label={label}
			onClick={async () => {
				if (copied) return;
				try {
					await navigator.clipboard.writeText(text);
					setCopied(true);
					setTimeout(() => setCopied(false), 1200);
				} catch {
					// Do nothing where the clipboard is unavailable (permissions, http).
				}
			}}
		>
			{copied ? copiedLabel : label}
		</button>
	);
}
