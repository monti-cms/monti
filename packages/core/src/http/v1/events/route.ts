import { z } from "zod";
import type { EventDeliveryState } from "../../../core/store";
import { adminRoute, json, parseWith, readQuery } from "../handler";

const STATES = [
	"pending",
	"delivering",
	"delivered",
	"failed",
	"dead",
	"dismissed",
] as const satisfies readonly EventDeliveryState[];

const querySchema = z.object({
	state: z.array(z.enum(STATES)).optional(),
	limit: z.coerce.number().int().min(1).max(200).optional(),
	offset: z.coerce.number().int().min(0).optional(),
});

/** `GET /v1/events`: the deliveries of the event outbox (default: the failed and dead ones, newest first) and how many there are in each state. */
export const GET = adminRoute(async ({ request, cms }) => {
	const query = parseWith(querySchema, readQuery(request, ["state"]), "Invalid query");
	const [list, counts] = await Promise.all([
		cms.events.list({
			states: query.state?.length ? query.state : undefined,
			limit: query.limit,
			offset: query.offset,
		}),
		cms.events.counts(),
	]);
	return json({ ...list, counts });
});
