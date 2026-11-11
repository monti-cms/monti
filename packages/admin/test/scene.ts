import { composeStory } from "@storybook/react-vite";

type Loader = (...args: never[]) => Promise<object> | object;
type StoryLike = { loaders?: unknown; play?: unknown; render?: unknown };

/**
 * A story drawn for a screen test with what its loaders made at hand (the site, the entry's id): the test reads what the operations say about the
 * same data. With only `loaders`, it is a state no story draws: the screen on that site, brought nowhere.
 */
export function scene<Loaded extends object>(story: StoryLike, meta: object) {
	const held: { loaded?: object } = {};
	const loaders = ([] as Loader[])
		.concat((story.loaders ?? []) as Loader | Loader[])
		.map((load) => async (...args: never[]) => {
			const made = await load(...args);
			held.loaded = { ...held.loaded, ...made };
			return made;
		});
	const composed = composeStory({ ...story, loaders } as never, meta as never);
	return {
		run: () => composed.run(),
		loaded: (): Loaded => {
			if (!held.loaded) throw new Error("the story has not loaded");
			return held.loaded as Loaded;
		},
	};
}
