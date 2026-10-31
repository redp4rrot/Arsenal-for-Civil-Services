import { getCachedIssues } from "./github.js";
import { parseDailyRecords, calculateStreaks, getRecordForDate } from "./streaks.js";
import { CONFIG } from "./config.js";

const element = id => document.getElementById(id);
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const monthIndex = (year, month) => year * 12 + month;
const normalizeMonth = (year, month) => {
    const date = new Date(year, month, 1);
    return { year: date.getFullYear(), month: date.getMonth() };
};
const FESTIVALS = {
    "2026-11": [
        { day: 1, name: "Ahoi Ashtami" },
        { day: 6, name: "Dhanteras" },
        { day: 8, name: "Diwali · Lakshmi Puja" },
        { day: 10, name: "Govardhan Puja" },
        { day: 11, name: "Bhai Dooj" },
        { day: 15, name: "Chhath Puja" },
        { day: 20, name: "Devutthana Ekadashi" },
        { day: 21, name: "Tulsi Vivah" },
        { day: 24, name: "Dev Diwali · Guru Nanak Jayanti · Kartik Purnima" }
    ]
};

let records = new Map();
let visibleYear = new Date().getFullYear();
let visibleMonth = new Date().getMonth();
let selectedDay = new Date().getDate();
let latestDataMonth = monthIndex(visibleYear, visibleMonth);
let loadSequence = 0;

function formatDate(year, month, day) {
    return new Intl.DateTimeFormat("en-GB", {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
    }).format(new Date(year, month, day));
}

function describeRecord(record) {
    if (!record) return "No entry recorded";
    if (record.status === "half") return "Half day · " + record.hours.toFixed(1) + " hours";
    return "Study logged · " + record.hours.toFixed(1) + " hours";
}

function renderSelectedDay() {
    const record = getRecordForDate(records, visibleYear, visibleMonth, selectedDay);
    element("selected-date-title").textContent = formatDate(visibleYear, visibleMonth, selectedDay);
    element("selected-date-status").textContent = describeRecord(record);
    element("selected-date-hours").textContent = record?.hours != null ? record.hours.toFixed(1) + " hrs" : "—";
}

function renderFestivals() {
    const panel = element("calendar-festivals");
    if (!panel) return;
    const key = String(visibleYear) + "-" + String(visibleMonth + 1).padStart(2, "0");
    const today = new Date();
    const isFutureMonth = monthIndex(visibleYear, visibleMonth) > monthIndex(today.getFullYear(), today.getMonth());
    const events = (FESTIVALS[key] || []).filter(event => isFutureMonth || event.day >= today.getDate());

    panel.replaceChildren();
    panel.hidden = events.length === 0;
    if (!events.length) return;

    const heading = document.createElement("h3");
    heading.textContent = "Upcoming festivals";
    panel.append(heading);
    const list = document.createElement("div");
    list.className = "festival-list";
    for (const event of events) {
        const item = document.createElement("div");
        item.className = "festival-item";
        const date = document.createElement("strong");
        date.textContent = String(event.day).padStart(2, "0");
        const name = document.createElement("span");
        name.textContent = event.name;
        item.append(date, name);
        list.append(item);
    }
    panel.append(list);
    const note = document.createElement("p");
    note.className = "festival-note";
    note.textContent = "Dates follow the Jaipur calendar; local observance may vary.";
    panel.append(note);
}

function renderCalendar() {
    const grid = element("calendar-grid");
    if (!grid) return;
    element("calendar-month-label").textContent = MONTHS[visibleMonth] + " " + visibleYear;
    grid.replaceChildren();

    const offset = new Date(visibleYear, visibleMonth, 1).getDay();
    const daysInMonth = new Date(visibleYear, visibleMonth + 1, 0).getDate();
    const today = new Date();
    const firstMonth = CONFIG.productivity.startYear * 12 + CONFIG.productivity.startMonth;

    for (let i = 0; i < offset; i++) {
        const blank = document.createElement("span");
        blank.className = "calendar-empty";
        blank.setAttribute("aria-hidden", "true");
        grid.append(blank);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const record = getRecordForDate(records, visibleYear, visibleMonth, day);
        const isFutureDate = monthIndex(visibleYear, visibleMonth) > monthIndex(today.getFullYear(), today.getMonth()) ||
            (visibleYear === today.getFullYear() && visibleMonth === today.getMonth() && day > today.getDate());
        const status = record ? record.status : (isFutureDate ? "empty" : "holiday");
        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = "calendar-day is-" + status;
        tile.textContent = String(day);
        tile.setAttribute("aria-pressed", String(day === selectedDay));
        if (day === selectedDay) tile.classList.add("is-selected");
        if (visibleYear === today.getFullYear() && visibleMonth === today.getMonth() && day === today.getDate()) {
            tile.classList.add("is-today");
        }
        tile.title = formatDate(visibleYear, visibleMonth, day) + " — " +
            (record ? describeRecord(record) : isFutureDate ? "Upcoming day" : "Holiday · no study entry");
        tile.addEventListener("click", () => {
            selectedDay = day;
            renderCalendar();
        });
        grid.append(tile);
    }

    const previous = normalizeMonth(visibleYear, visibleMonth - 1);
    const next = normalizeMonth(visibleYear, visibleMonth + 1);
    element("calendar-previous").disabled = monthIndex(previous.year, previous.month) < firstMonth;
    element("calendar-next").disabled = monthIndex(next.year, next.month) >
        Math.max(monthIndex(today.getFullYear(), today.getMonth()), latestDataMonth);

    renderSelectedDay();
    renderFestivals();
}

function updateStreakMetrics() {
    const streaks = calculateStreaks(records, visibleYear, visibleMonth);
    element("current-streak").textContent = String(streaks.current);
    element("longest-streak").textContent = String(streaks.longest);
}

export async function loadStudyCalendar(forceRefresh = false) {
    const sequence = ++loadSequence;
    const grid = element("calendar-grid");
    grid?.setAttribute("aria-busy", "true");
    element("calendar-month-label").textContent = MONTHS[visibleMonth] + " " + visibleYear;
    element("calendar-load-status").textContent = "Loading study records from GitHub…";

    try {
        const issues = await getCachedIssues(forceRefresh);
        if (sequence !== loadSequence) return;
        records = parseDailyRecords(issues);
        const now = new Date();
        const currentMonth = monthIndex(now.getFullYear(), now.getMonth());
        latestDataMonth = records.size
            ? Math.max(...Array.from(records.values(), record => monthIndex(record.year, record.month - 1)))
            : currentMonth;

        if (latestDataMonth > currentMonth) {
            const latest = normalizeMonth(Math.floor(latestDataMonth / 12), latestDataMonth % 12);
            visibleYear = latest.year;
            visibleMonth = latest.month;
            selectedDay = 1;
        }

        updateStreakMetrics();
        element("calendar-load-status").textContent = "Loaded " + records.size + " dated records.";
        renderCalendar();
    } catch (error) {
        console.error("Study calendar failed to load:", error);
        element("calendar-load-status").textContent = "Unable to load study calendar: " + error.message;
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
        updateStreakMetrics();
        renderCalendar();
    });

    element("calendar-next")?.addEventListener("click", () => {
        const next = normalizeMonth(visibleYear, visibleMonth + 1);
        visibleYear = next.year;
        visibleMonth = next.month;
        selectedDay = 1;
        updateStreakMetrics();
        renderCalendar();
    });
}
