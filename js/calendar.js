import { getCachedIssues } from "./github.js";
import { parseDailyRecords, calculateStreaks, getRecordForDate } from "./streaks.js";
import { CONFIG } from "./config.js";

const element = id => document.getElementById(id);
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

let records = new Map();
let visibleYear = new Date().getFullYear();
let visibleMonth = new Date().getMonth();
let selectedDay = new Date().getDate();
let loadSequence = 0;

const monthIndex = (year, month) => year * 12 + month;

function normalizeMonth(year, month) {
    const date = new Date(year, month, 1);
    return { year: date.getFullYear(), month: date.getMonth() };
}

function formatDate(year, month, day) {
    return new Intl.DateTimeFormat("en-GB", {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
    }).format(new Date(year, month, day));
}

function describeRecord(record) {
    if (!record) return "No entry recorded";
    if (record.status === "holiday") return "Full-day holiday";
    if (record.status === "half") return `Half day · ${record.hours.toFixed(1)} hours`;
    return `Study logged · ${record.hours.toFixed(1)} hours`;
}

function renderSelectedDay() {
    const record = getRecordForDate(records, visibleYear, visibleMonth, selectedDay);
    element("selected-date-title").textContent =
        formatDate(visibleYear, visibleMonth, selectedDay);
    element("selected-date-status").textContent = describeRecord(record);
    element("selected-date-hours").textContent =
        record?.hours != null ? `${record.hours.toFixed(1)} hrs`
            : record?.status === "holiday" ? "Holiday" : "—";
}

function renderCalendar() {
    const grid = element("calendar-grid");
    if (!grid) return;

    element("calendar-month-label").textContent =
        `${MONTHS[visibleMonth]} ${visibleYear}`;
    grid.replaceChildren();

    const offset = new Date(visibleYear, visibleMonth, 1).getDay();
    const daysInMonth = new Date(visibleYear, visibleMonth + 1, 0).getDate();
    const today = new Date();
    const firstMonth = CONFIG.productivity.startYear * 12 + CONFIG.productivity.startMonth;
    const currentMonth = monthIndex(visibleYear, visibleMonth);

    for (let i = 0; i < offset; i++) {
        const blank = document.createElement("span");
        blank.className = "calendar-empty";
        blank.setAttribute("aria-hidden", "true");
        grid.append(blank);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const record = getRecordForDate(records, visibleYear, visibleMonth, day);
        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = `calendar-day ${record ? `is-${record.status}` : "is-empty"}`;
        tile.textContent = String(day);
        tile.setAttribute("aria-pressed", String(day === selectedDay));

        if (day === selectedDay) tile.classList.add("is-selected");
        if (visibleYear === today.getFullYear() &&
            visibleMonth === today.getMonth() && day === today.getDate()) {
            tile.classList.add("is-today");
        }

        tile.title = `${formatDate(visibleYear, visibleMonth, day)} — ${describeRecord(record)}`;
        tile.addEventListener("click", () => {
            selectedDay = day;
            renderCalendar();
        });
        grid.append(tile);
    }

    const previous = normalizeMonth(visibleYear, visibleMonth - 1);
    const next = normalizeMonth(visibleYear, visibleMonth + 1);
    element("calendar-previous").disabled =
        monthIndex(previous.year, previous.month) < firstMonth;
    element("calendar-next").disabled =
        monthIndex(next.year, next.month) > monthIndex(today.getFullYear(), today.getMonth());

    renderSelectedDay();
}

export async function loadStudyCalendar(forceRefresh = false) {
    const sequence = ++loadSequence;
    const grid = element("calendar-grid");
    grid?.setAttribute("aria-busy", "true");

    try {
        const issues = await getCachedIssues(forceRefresh);
        if (sequence !== loadSequence) return;

        records = parseDailyRecords(issues);
        const streaks = calculateStreaks(records);
        element("current-streak").textContent = String(streaks.current);
        element("longest-streak").textContent = String(streaks.longest);
        element("calendar-load-status").textContent = "";
        renderCalendar();
    } catch (error) {
        console.error("Study calendar failed to load:", error);
        const status = element("calendar-load-status");
        if (status) status.textContent = "Unable to load study calendar. Please refresh.";
    } finally {
        if (sequence === loadSequence) grid?.removeAttribute("aria-busy");
    }
}

export function setupCalendarEvents() {
    element("calendar-previous")?.addEventListener("click", () => {
        const previous = normalizeMonth(visibleYear, visibleMonth - 1);
        visibleYear = previous.year;
        visibleMonth = previous.month;
        selectedDay = 1;
        renderCalendar();
    });

    element("calendar-next")?.addEventListener("click", () => {
        const next = normalizeMonth(visibleYear, visibleMonth + 1);
        visibleYear = next.year;
        visibleMonth = next.month;
        selectedDay = 1;
        renderCalendar();
    });
}
