import { useEffect, useState } from "react";

/** 값이 `delay`ms 동안 바뀌지 않아야 따라 바뀐다. 첫 값은 바로 쓴다. 입력하는 동안 요청을 여러 번 보내지 않게 한다. */
export function useDebounced<T>(value: T, delay: number): T {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delay);
		return () => clearTimeout(timer);
	}, [value, delay]);
	return debounced;
}
