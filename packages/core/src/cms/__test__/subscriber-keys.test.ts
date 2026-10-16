import { describe, expect, it } from "vitest";
import { moveOldSubscriberKeys } from "../subscriber-keys";

/** An event store with delivery rows under the given subscriber keys, recording what was moved. */
const storeWith = (keys: readonly string[]) => {
	const moves: string[] = [];
	return {
		moves,
		store: {
			deliverySubscribers: async () => keys,
			renameSubscriber: async ({ from, to }: { from: string; to: string }) => {
				moves.push(`${from} -> ${to}`);
				return 3;
			},
		},
	};
};

describe("moveOldSubscriberKeys", () => {
	it("moves the rows of an owner's old key to its one afterCommit subscriber", async () => {
		const { store, moves } = storeWith(["plugin:git-sync", "server", "server:revalidate"]);
		const log: string[] = [];
		await moveOldSubscriberKeys({
			store,
			subscribers: [{ name: "server:revalidate" }, { name: "plugin:git-sync:sync" }],
			log: (line) => log.push(line),
		});
		expect(moves).toEqual(["plugin:git-sync -> plugin:git-sync:sync", "server -> server:revalidate"]);
		expect(log.join("\n")).toContain(
			'Moved 3 event deliveries from "plugin:git-sync" to its subscriber "plugin:git-sync:sync".',
		);
	});

	it("does not take another owner's subscriber for an owner whose name starts the same", async () => {
		const { store, moves } = storeWith(["plugin:git"]);
		await moveOldSubscriberKeys({ store, subscribers: [{ name: "plugin:git-sync:sync" }], log: () => undefined });
		expect(moves).toEqual([]);
	});

	it("leaves the rows of an owner that has no afterCommit subscriber any more", async () => {
		const { store, moves } = storeWith(["plugin:gone"]);
		await moveOldSubscriberKeys({ store, subscribers: [], log: () => undefined });
		expect(moves).toEqual([]);
	});

	it("stops, saying what to do, when the owner has several subscribers and the old rows cannot say which one they were for", async () => {
		const { store, moves } = storeWith(["server"]);
		await expect(
			moveOldSubscriberKeys({
				store,
				subscribers: [{ name: "server:revalidate" }, { name: "server:notify" }],
				log: () => undefined,
			}),
		).rejects.toThrow(/keep one afterCommit subscriber for server/);
		expect(moves).toEqual([]);
	});

	it("does nothing once the keys are new", async () => {
		const { store, moves } = storeWith(["server:revalidate", "plugin:git-sync:sync"]);
		await moveOldSubscriberKeys({ store, subscribers: [{ name: "server:revalidate" }], log: () => undefined });
		expect(moves).toEqual([]);
	});
});
