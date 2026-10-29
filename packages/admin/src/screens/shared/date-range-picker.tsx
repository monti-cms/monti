/** `YYYY-MM-DD` ↔ calendar date. The admin filter takes dates in the configured time zone and sends them to the server as day boundaries. */
export const dayToDate = (value: string) => {
	if (!value) return undefined;
	const [y, m, d] = value.split("-").map(Number);
	return new Date(y as number, (m as number) - 1, d);
};

export const dateToDay = (date: Date | undefined) =>
	date
		? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
		: "";
