import { useEffect, useState } from "react";

/** The value follows only after it has not changed for `delay` ms. The first value is used immediately. Avoids sending many requests while typing. */
export function useDebounced<T>(value: T, delay: number): T {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delay);
		return () => clearTimeout(timer);
	}, [value, delay]);
	return debounced;
}
