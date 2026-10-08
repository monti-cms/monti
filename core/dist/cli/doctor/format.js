export function summarize(checks) {
    const count = (status) => checks.filter((check) => check.status === status).length;
    return { ok: count("ok"), warn: count("warn"), fail: count("fail"), skip: count("skip") };
}
const LABEL = { ok: "ok  ", warn: "warn", fail: "FAIL", skip: "skip" };
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
/** The report as plain text: the checks grouped, each with its status, and for a warn or a fail where it is and how to fix it. */
export function formatDoctorReport(report) {
    const width = Math.max(0, ...report.checks.map((check) => check.id.length));
    const out = [`monti doctor: ${report.cwd}`, ""];
    let group;
    for (const check of report.checks) {
        if (check.group !== group) {
            if (group !== undefined)
                out.push("");
            group = check.group;
        }
        const indent = " ".repeat(2 + 4 + 2 + width + 2);
        const [first = "", ...rest] = check.message.split("\n");
        out.push(`  ${LABEL[check.status]}  ${check.id.padEnd(width)}  ${first}`);
        for (const line of rest)
            out.push(`${indent}${line}`);
        if (check.status === "warn" || check.status === "fail") {
            if (check.where)
                out.push(`${indent}where: ${check.where}`);
            if (check.fix)
                out.push(`${indent}fix:   ${check.fix.replaceAll("\n", `\n${indent}       `)}`);
        }
    }
    const { summary } = report;
    out.push("", [
        `${summary.ok} ok`,
        plural(summary.warn, "warning", "warnings"),
        `${summary.fail} failed`,
        ...(summary.skip > 0 ? [`${summary.skip} not checked`] : []),
    ].join(", "));
    if (summary.fail > 0)
        out.push("Fix the failed checks (marked FAIL) first, then run `monti doctor` again.");
    else if (summary.warn > 0)
        out.push("Nothing is broken. The warnings are worth a look before you deploy.");
    else
        out.push("Everything checked is in order.");
    return out.join("\n");
}
