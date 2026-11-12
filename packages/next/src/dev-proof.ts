import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { DevProof } from "@monti-cms/core";

/** How long a ticket waits to be handed in. */
const TICKET_MS = 60_000;
/** Tickets waiting at once: a page that asks again and again does not fill the memory. */
const MOST = 200;
const LOOPBACK = /^(localhost|127(\.\d{1,3}){3}|\[::1\]|[\w-]+\.localhost)$/;

/** Whether an origin (`http://localhost:3000`) or a host (`127.0.0.1:49152`) names this machine. */
export function isLoopback(value: string | undefined, kind: "origin" | "host"): boolean {
	if (!value) return false;
	try {
		const url = new URL(kind === "origin" ? value : `http://${value}`);
		return (kind === "host" || /^https?:$/.test(url.protocol)) && LOOPBACK.test(url.hostname);
	} catch {
		return false;
	}
}

/**
 * The proof that a browser runs on this machine (doc 16): a listener on the loopback address, which nothing outside the machine reaches, gives a
 * one-time ticket to a page of a local origin. The admin's page fetches one and hands it to the admin API, which then lets it in without
 * signing in. A request's headers cannot do this job: the sender writes them.
 *
 * - Only the loopback address is listened on, at a port the system picks.
 * - Only a page of a local origin can read the ticket (CORS), and a name that merely resolves to this machine is turned away by its `Host`.
 * - A ticket is good once, for a minute.
 */
export function loopbackProof(now: () => number = Date.now): DevProof & { close(): void } {
	const tickets = new Map<string, number>();
	let url: string | null = null;
	const server = createServer((request, response) => {
		const origin = request.headers.origin;
		if (!isLoopback(origin, "origin") || !isLoopback(request.headers.host, "host")) {
			response.writeHead(403).end();
			return;
		}
		const cors = { "access-control-allow-origin": origin as string, vary: "Origin", "cache-control": "no-store" };
		// A browser asks first before a page reaches a more private address than its own.
		if (request.method === "OPTIONS") {
			response.writeHead(204, { ...cors, "access-control-allow-private-network": "true" }).end();
			return;
		}
		if (request.method !== "GET") {
			response.writeHead(405, cors).end();
			return;
		}
		for (const [ticket, until] of tickets) if (until <= now() || tickets.size >= MOST) tickets.delete(ticket);
		const ticket = randomBytes(24).toString("base64url");
		tickets.set(ticket, now() + TICKET_MS);
		response.writeHead(200, { ...cors, "content-type": "application/json" }).end(JSON.stringify({ ticket }));
	});
	server.on("error", () => {
		// No listener, no ticket: the admin asks to sign in.
		url = null;
	});
	server.listen(0, "127.0.0.1", () => {
		const address = server.address();
		if (address && typeof address === "object") url = `http://127.0.0.1:${address.port}/`;
	});
	// The listener does not keep the server's process alive.
	server.unref();
	return {
		url: () => url,
		take(ticket) {
			const until = tickets.get(ticket);
			tickets.delete(ticket);
			return until !== undefined && until > now();
		},
		close: () => void server.close(),
	};
}
