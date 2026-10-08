import type { CheckStatus } from "./outcome.js";
/** One line of the report: a check and what it found. */
export interface DoctorResult {
    /** `<group>/<check>`, for example `database/migrations` or `auth/admins`. */
    readonly id: string;
    /** What the check belongs to: a part of the setup (`config`, `database`, ...). */
    readonly group: string;
    /** What the check looks at, in a few words. */
    readonly title: string;
    readonly status: CheckStatus;
    readonly message: string;
    readonly where?: string;
    readonly fix?: string;
}
export interface DoctorSummary {
    readonly ok: number;
    readonly warn: number;
    readonly fail: number;
    readonly skip: number;
}
/** What `monti doctor` finds, and what `--json` prints. */
export interface DoctorReport {
    /** `false` when any check failed (the exit code is 1). Warnings do not count. */
    readonly ok: boolean;
    /** The app folder. */
    readonly cwd: string;
    readonly summary: DoctorSummary;
    readonly checks: readonly DoctorResult[];
}
export declare function summarize(checks: readonly DoctorResult[]): DoctorSummary;
/** The report as plain text: the checks grouped, each with its status, and for a warn or a fail where it is and how to fix it. */
export declare function formatDoctorReport(report: DoctorReport): string;
