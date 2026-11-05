import { getCachedIssues } from "./github.js";
import { parseDailyRecords, calculateStreaks, getRecordForDate } from "./streaks.js";
import { CONFIG } from "./config.js";
import { marked } from "https://cdn.jsdelivr.net/npm/marked@15.0.12/lib/marked.esm.js";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.2.6/dist/purify.es.mjs";

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
        { day: 10, name: "Govardhan Puja · Bhai Dooj (Jaipur)" },
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
let taskLoadSequence = 0;
let cachedTasks = [];


function formatDate(year, month, day) {
    return new Intl.DateTimeFormat("en-GB", {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
    }).format(new Date(year, month, day));
}

function describeRecord(record) {
    if (!record || record.hours == null || !Number.isFinite(Number(record.hours))) return "No study-hours entry";
    if (record.status === "low") return "Low day · under 5 hours";
    if (record.status === "half") return "Half day · " + Number(record.hours).toFixed(1) + " hours";
    return "Study logged · " + Number(record.hours).toFixed(1) + " hours";
}

function selectedDateISO() {
    return visibleYear + "-" + String(visibleMonth + 1).padStart(2, "0") + "-" +
        String(selectedDay).padStart(2, "0");
}

function renderTodayPlan() {
    const section = element("today-plan");
    if (section) section.hidden = false;
    const heading = section?.querySelector(".today-plan-heading span");
    if (heading) heading.textContent = "TASKS FOR SELECTED DAY";
}

function showPlanMessage(message, isError = false) {
    const list = element("today-plan-list");
    const count = element("today-plan-count");
    list.replaceChildren();
    count.textContent = "";
    const note = document.createElement("p");
    note.className = "today-plan-empty" + (isError ? " is-error" : "");
    note.textContent = message;
    list.append(note);
}

function renderTodayTasks(tasks) {
    const list = element("today-plan-list");
    const count = element("today-plan-count");
    list.replaceChildren();
    count.textContent = tasks.length ? String(tasks.length) : "";
    if (!tasks.length) {
        showPlanMessage("No tasks scheduled for this day.");
        return;
    }
    const order = ["Morning", "Post lunch", "Post evening tea", "Late night"];
    tasks.sort((a, b) => {
        const rank = task => {
            const indexes = task.slots.map(slot => {
                const index = order.findIndex(value => value.toLowerCase() === slot.toLowerCase());
                return index < 0 ? order.length : index;
            });
            return indexes.length ? Math.min(...indexes) : order.length + 1;
        };
        return rank(a) - rank(b);
    });
    for (const task of tasks) {
        const item = document.createElement("article");
        item.className = "today-task";
        const main = document.createElement("div");
        main.className = "today-task-main";
        const title = document.createElement("div");
        title.className = "today-task-title";
        title.innerHTML = DOMPurify.sanitize(marked.parseInline(task.title || ""));
        main.append(title);
        if (task.url) {
            const link = document.createElement("a");
            link.className = "today-task-open";
            link.href = task.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "Open task ↗";
            main.append(link);
        }
        item.append(main);
        const status = document.createElement("span");
        const statusText = task.status || "No status";
        status.className = "today-task-status status-" + statusText.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        status.textContent = statusText;
        item.append(status);
        if (task.slots.length) {
            const slots = document.createElement("div");
            slots.className = "today-task-slots";
            for (const slot of task.slots) {
                const tag = document.createElement("span");
                tag.className = "today-task-slot";
                tag.textContent = slot;
                slots.append(tag);
            }
            item.append(slots);
        } else {
            const tag = document.createElement("span");
            tag.className = "today-task-unscheduled";
            tag.textContent = "No time slot";
            item.append(tag);
        }
        list.append(item);
    }
}

export async function refreshTodayPlan() {
    const requestId = ++taskLoadSequence;
    const section = element("today-plan");
    if (!section) return;
    section.hidden = false;
    showPlanMessage("Refreshing tasks…");
    try {
        const response = await fetch("./data/today-tasks.json?ts=" + Date.now(), {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" }
        });
        if (!response.ok) throw new Error("Task data unavailable (" + response.status + ").");
        const snapshot = await response.json();
        if (requestId !== taskLoadSequence) return;
        cachedTasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
        renderTasksForSelectedDate();
    } catch (error) {
        if (requestId === taskLoadSequence) {
            showPlanMessage("Couldn't load tasks: " + error.message, true);
        }
    }
}

function renderTasksForSelectedDate() {
    const date = selectedDateISO();
    const tasks = cachedTasks.filter(task => task.date === date).map(task => ({
        ...task,
        slots: Array.isArray(task.slots) ? task.slots : []
    }));
    renderTodayTasks(tasks);
}

function installWorklogMarkdownStyles() {
    if (document.getElementById("worklog-markdown-styles")) return;
    const style = document.createElement("style");
    style.id = "worklog-markdown-styles";
    style.textContent = `
        .selected-date-log { white-space:normal; overflow-wrap:anywhere; }
        .selected-date-log > :first-child { margin-top:0; }
        .selected-date-log > :last-child { margin-bottom:0; }
        .selected-date-log p { margin:0 0 10px; line-height:1.75; }
        .selected-date-log ul,.selected-date-log ol { margin:8px 0 12px; padding-left:24px; }
        .selected-date-log li { margin:5px 0; padding-left:2px; line-height:1.7; }
        .selected-date-log li input[type="checkbox"] { margin:0 8px 0 0; accent-color:var(--green); vertical-align:middle; }
        .selected-date-log code { padding:2px 5px; border:1px solid var(--border); border-radius:4px; background:var(--panel-2); color:var(--text); font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:.9em; }
        .selected-date-log pre { max-width:100%; overflow-x:auto; padding:12px; border:1px solid var(--border); border-radius:8px; background:var(--panel-2); }
        .selected-date-log pre code { padding:0; border:0; background:transparent; }
        .selected-date-log blockquote { margin:10px 0; padding:2px 0 2px 14px; border-left:3px solid var(--border); color:var(--muted); }
        .selected-date-log a { color:var(--yellow); text-decoration:underline; text-underline-offset:2px; }
        .selected-date-log hr { margin:14px 0; border:0; border-top:1px solid var(--border); }
        .selected-date-log table { display:block; max-width:100%; overflow-x:auto; border-collapse:collapse; }
        .selected-date-log th,.selected-date-log td { padding:6px 9px; border:1px solid var(--border); text-align:left; }
    `;
    document.head.append(style);
}

function renderSelectedDay() {
    const record = getRecordForDate(records, visibleYear, visibleMonth, selectedDay);
    element("selected-date-title").textContent = formatDate(visibleYear, visibleMonth, selectedDay);
    element("selected-date-status").textContent = describeRecord(record);
    element("selected-date-hours").textContent = record?.hours != null ? record.hours.toFixed(1) + " hrs" : "—";
    const panel = element("selected-date-log");
    if (!panel) return;
    const log = typeof record?.log === "string" ? record.log.trim() : "";
    panel.hidden = log.length === 0;
    if (log.length) {
        installWorklogMarkdownStyles();
        const markdownHtml = marked.parse(log, { gfm: true, breaks: true });
        panel.innerHTML = DOMPurify.sanitize(markdownHtml);
    } else {
        panel.replaceChildren();
    }
    panel.classList.toggle("has-log", log.length > 0);
    renderTodayPlan();
}

function renderFestivals() {
    const panel = element("calendar-festivals");
    if (!panel) return;
    const key = String(visibleYear) + "-" + String(visibleMonth + 1).padStart(2, "0");
    const today = new Date();
    const isCurrentMonth = visibleYear === today.getFullYear() && visibleMonth === today.getMonth();
    const events = isCurrentMonth ? (FESTIVALS[key] || []).filter(event => event.day >= today.getDate()) : [];

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
    renderTodayPlan();
    renderTasksForSelectedDate();
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
