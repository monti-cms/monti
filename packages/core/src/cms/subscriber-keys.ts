import { problemError } from "../core/problem";
import type { EventStore } from "../core/store";

/** The outbox key of a subscriber before each `afterCommit` had a name: only its owner (`server`, `plugin:<name>`). */
const OLD_KEY = /^(server|plugin:[a-z][a-z0-9-]*)$/;

/**
 * The one-time move of `monti db:migrate` for the subscriber keys of the outbox. Before the hooks were lists, an owner had one `afterCommit` and its deliveries
 * were kept under the owner (`plugin:git-sync`); now each subscriber is `<owner>:<name>` (`plugin:git-sync:sync`). The rows of an old key move to the owner's
 * one subscriber, so nothing that was waiting is lost. An owner with several subscribers cannot say which one the rows were for, so it stops and says what to do;
 * an owner that has none keeps its rows as they are (nothing would deliver them before either). Once the rows have moved there is nothing left to do, so running
 * it again changes nothing.
 */
export async function moveOldSubscriberKeys(parts: {
	readonly store: Pick<EventStore, "deliverySubscribers" | "renameSubscriber">;
	readonly subscribers: readonly { readonly name: string }[];
	readonly log: (message: string) => void;
}): Promise<void> {
	const { store, subscribers, log } = parts;
	for (const key of (await store.deliverySubscribers()).filter((name) => OLD_KEY.test(name))) {
		const prefix = `${key}:`;
		const owned = subscribers
			.map((subscriber) => subscriber.name)
			.filter((name) => name.startsWith(prefix) && !name.slice(prefix.length).includes(":"));
		if (owned.length === 0) continue;
		if (owned.length > 1) {
			throw problemError({
				what: `The event deliveries kept under "${key}" cannot be moved: ${key} now has ${owned.length} afterCommit subscribers (${owned.join(", ")}), and the old deliveries do not say which one they were for`,
				where: "the `hooks.afterCommit` list of the server config or of the plugin",
				fix: `keep one afterCommit subscriber for ${key} (the one that did this work before), run \`monti db:migrate\` once, then add the others`,
			});
		}
		const [to] = owned as [string];
		const moved = await store.renameSubscriber({ from: key, to });
		log(`Moved ${moved} event deliver${moved === 1 ? "y" : "ies"} from "${key}" to its subscriber "${to}".`);
	}
}
