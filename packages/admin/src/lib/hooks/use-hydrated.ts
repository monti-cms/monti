import { useSyncExternalStore } from "react";

const subscribeNothing = () => () => {};

/** False during server render and hydration, true afterwards. Use it to render values the server cannot know (such as the theme) after hydration. */
export const useHydrated = () =>
	useSyncExternalStore(
		subscribeNothing,
		() => true,
		() => false,
	);
