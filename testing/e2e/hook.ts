// A webhook's other end, for the flow tests (doc 13): the place the example app's `MONTI_WEBHOOK` posts every event to. It answers 200 and keeps
// what arrived, until a test takes it down; then it answers 503, as a search index or a deploy hook that is out does.
//
//   tsx testing/e2e/hook.ts 4176
//
//   POST /hook        an event from Monti
//   POST /down, /up   a test takes it down and brings it back
//   GET  /arrived     what arrived, oldest first: each event with the headers Monti sent it with
import { createServer } from "node:http";

const port = Number(process.argv[2]);
if (!Number.isInteger(port)) throw new Error("hook.ts needs a port.");

let down = false;
const arrived: { event: unknown; headers: Record<string, string | string[] | undefined> }[] = [];

createServer((request, response) => {
	const answer = (status: number, body: unknown = {}) => {
		response.writeHead(status, { "content-type": "application/json" });
		response.end(JSON.stringify(body));
	};
	const path = `${request.method} ${request.url}`;
	if (path === "POST /down" || path === "POST /up") {
		down = path === "POST /down";
		return answer(200);
	}
	if (path === "GET /arrived") return answer(200, arrived);
	if (path !== "POST /hook") return answer(request.method === "GET" ? 200 : 404);
	const chunks: Buffer[] = [];
	request.on("data", (chunk: Buffer) => chunks.push(chunk));
	request.on("end", () => {
		if (down) return answer(503, { error: "down" });
		const headers = Object.fromEntries(Object.entries(request.headers).filter(([name]) => name.startsWith("monti-")));
		arrived.push({ event: JSON.parse(Buffer.concat(chunks).toString("utf8")), headers });
		answer(200);
	});
}).listen(port);
