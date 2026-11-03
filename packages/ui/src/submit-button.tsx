"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./button";

/**
 * A `Button` that sends its form by a plain post (no script handles it) and is `loading` from the moment the form is sent until the next page
 * comes: `pendingLabel` replaces its words ("로그인 중…"), and it cannot be pressed twice. Coming back to the page (the browser's back) wakes it.
 */
function SubmitButton({
	pendingLabel,
	children,
	...props
}: Omit<React.ComponentProps<typeof Button>, "type" | "loading"> & {
	/** What the button says while the form is on its way. */
	pendingLabel: React.ReactNode;
}) {
	const ref = useRef<HTMLButtonElement>(null);
	const [sending, setSending] = useState(false);
	useEffect(() => {
		const form = ref.current?.form;
		if (!form) return;
		const sent = () => setSending(true);
		const back = () => setSending(false);
		form.addEventListener("submit", sent);
		window.addEventListener("pageshow", back);
		return () => {
			form.removeEventListener("submit", sent);
			window.removeEventListener("pageshow", back);
		};
	}, []);
	return (
		<Button ref={ref} type="submit" loading={sending} {...props}>
			{sending ? pendingLabel : children}
		</Button>
	);
}

export { SubmitButton };
