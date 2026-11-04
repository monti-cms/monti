import type { ColumnType, Generated } from "kysely";
import type { Actor, Message, MontiEvent, RecordRef } from "../operation";

type Json<T> = ColumnType<T, string, string>;

/** One row per write: who, what, and whether it can still be undone. */
export interface ActivityTable {
	id: string;
	at: Generated<Date>;
	actor: Json<Actor>;
	operation: string;
	summary: Json<Message>;
	targets: Json<RecordRef[]>;
	conversation_id: string | null;
	proposal_item_id: string | null;
	/** Until when undo works (30 days); null when the write cannot be undone. */
	undo_until: Date | null;
	undone_at: Date | null;
}

/** A record's state before a write and its version after it. `before` is null for a record the write created; `after_version` null when it removed one. */
export interface ActivitySnapshotTable {
	activity_id: string;
	kind: string;
	record_id: string;
	before: Json<unknown> | null;
	after_version: number | null;
}

/** An event to send to one receiver, queued in the write's transaction and sent after it commits. */
export interface DeliveryTable {
	id: string;
	activity_id: string;
	destination: string;
	event: Json<MontiEvent>;
	state: "pending" | "sent" | "failed" | "canceled";
	attempts: Generated<number>;
	last_error: string | null;
	next_attempt_at: Date | null;
	created_at: Generated<Date>;
}

export interface ProposalTable {
	id: string;
	conversation_id: string;
	request: string;
	status: "pending" | "applied" | "partial" | "discarded";
	created_at: Generated<Date>;
}

export type ProposalItemState = "pending" | "discarded" | "stale" | "applied" | "failed" | "skipped";

/** One write the assistant proposed: the operation, its input, and the versions it read. */
export interface ProposalItemTable {
	id: string;
	proposal_id: string;
	position: number;
	operation: string;
	input: Json<unknown>;
	base_versions: Json<Record<string, number>>;
	state: ProposalItemState;
	reason: Json<Message> | null;
	output: Json<unknown> | null;
	activity_id: string | null;
}

export interface Database {
	monti_activity: ActivityTable;
	monti_activity_snapshot: ActivitySnapshotTable;
	monti_delivery: DeliveryTable;
	monti_proposal: ProposalTable;
	monti_proposal_item: ProposalItemTable;
}
