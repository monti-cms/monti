import { useSyncExternalStore } from "react";

const subscribeNothing = () => () => {};

/** 서버 렌더와 hydration 중에는 false, 그 뒤에는 true. 서버가 알 수 없는 값(테마 등)을 그 뒤에 그릴 때 쓴다. */
export const useHydrated = () =>
	useSyncExternalStore(
		subscribeNothing,
		() => true,
		() => false,
	);
