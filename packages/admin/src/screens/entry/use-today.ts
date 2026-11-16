import { useEffect, useState } from "react";

/** The local day a moment is in. */
const dayOf = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/**
 * Today, as the person's clock has it, kept while the screen stays open: it changes at the next local midnight (a timer), and is looked at again
 * when the tab is shown or the window takes the focus, since a timer in a tab left in the background may run late. What is drawn from it (the
 * publish menu's dates, whether there is a menu at all) is then right for an entry left open overnight. The same `Date` is given until the day changes.
 */
export function useToday(): Date {
	const [today, setToday] = useState(() => new Date());
	useEffect(() => {
		let timer: ReturnType<typeof setTimeout>;
		const wait = () => {
			clearTimeout(timer);
			const now = new Date();
			const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
			timer = setTimeout(look, midnight.getTime() - now.getTime());
		};
		const look = () => {
			const now = new Date();
			setToday((was) => (dayOf(was) === dayOf(now) ? was : now));
			wait();
		};
		wait();
		document.addEventListener("visibilitychange", look);
		window.addEventListener("focus", look);
		return () => {
			clearTimeout(timer);
			document.removeEventListener("visibilitychange", look);
			window.removeEventListener("focus", look);
		};
	}, []);
	return today;
}
