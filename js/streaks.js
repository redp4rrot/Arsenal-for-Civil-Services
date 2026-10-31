import { CONFIG } from "./config.js";

const WORKLOG_RE = /_(\d{1,2})\/(\d{1,2})\/(\d{4})_\s+\*\*(\d+(?:\.\d+)?)\*\*/g;
const DATE_RE = /_?(\d{1,2})\/(\d{1,2})\/(\d{4})_?/;

const dateKey = (year, month, day) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

function isValidDate(year, month, day) {
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day;
}

/**
 * Convert monthly GitHub issue bodies into one record per calendar date.
 * A missing date is intentionally not interpreted as a holiday.
 */
export function parseDailyRecords(issues = []) {
    const records = new Map();

    for (const issue of issues) {
        if (!issue || issue.pull_request || typeof issue.body !== "string") continue;

        const body = issue.body;
        let match;
        WORKLOG_RE.lastIndex = 0;

        while ((match = WORKLOG_RE.exec(body)) !== null) {
            const day = Number(match[1]);
            const month = Number(match[2]);
            const year = Number(match[3]);
            const hours = Number(match[4]);

            if (!isValidDate(year, month, day) || !Number.isFinite(hours)) continue;

            const key = dateKey(year, month, day);
            records.set(key, {
                key, year, month, day, hours,
                status: hours >= 5 && hours <= 6 ? "half" : "study"
            });
        }

        // Only an explicit holiday/day-off marker on a date-bearing line counts.
        for (const line of body.split(/\r?\n/)) {
            if (!/\b(day off|holiday|leave)\b/i.test(line)) continue;
            const dateMatch = line.match(DATE_RE);
            if (!dateMatch) continue;

            const day = Number(dateMatch[1]);
            const month = Number(dateMatch[2]);
            const year = Number(dateMatch[3]);
            const key = dateKey(year, month, day);

            if (isValidDate(year, month, day) && !records.has(key)) {
                records.set(key, {
                    key, year, month, day, hours: null, status: "holiday"
                });
            }
        }
    }

    // Exclude anything before the configured calendar start.
    const firstMonth = CONFIG.productivity.startYear * 12 + CONFIG.productivity.startMonth;
    for (const [key, record] of records) {
        if (record.year * 12 + record.month - 1 < firstMonth) records.delete(key);
    }

    return records;
}

function isStudyDay(record) {
    return record?.status === "study" || record?.status === "half";
}

function previousDateKey(key) {
    const [year, month, day] = key.split("-").map(Number);
    const date = new Date(year, month - 1, day - 1);
    return dateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function calculateStreaks(records, today = new Date()) {
    const studyDates = [...records.values()]
        .filter(isStudyDay)
        .map(record => record.key)
        .sort();

    let longest = 0;
    let run = 0;
    let previous = null;

    for (const key of studyDates) {
        run = previous && previousDateKey(key) === previous ? run + 1 : 1;
        longest = Math.max(longest, run);
        previous = key;
    }

    const todayKey = dateKey(today.getFullYear(), today.getMonth() + 1, today.getDate());
    const yesterdayKey = previousDateKey(todayKey);

    // If today has not been logged yet, yesterday can still anchor the active streak.
    let cursor = isStudyDay(records.get(todayKey))
        ? todayKey
        : isStudyDay(records.get(yesterdayKey)) ? yesterdayKey : null;

    let current = 0;
    while (cursor && isStudyDay(records.get(cursor))) {
        current += 1;
        cursor = previousDateKey(cursor);
    }

    return { current, longest };
}

export function getRecordForDate(records, year, monthIndex, day) {
    return records.get(dateKey(year, monthIndex + 1, day)) || null;
}
