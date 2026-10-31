import { CONFIG } from "./config.js";

import { state } from "./state.js";

import {
    getMonthLabel,
    getIssueTitle,
    isBeforeStart,
    isFutureMonth,
    normalizeMonth
} from "./dates.js";

import {
    getCachedIssues,
    findIssueForMonth
} from "./github.js";

import {
    emptyProductivity,
    parseWorkingHours,
    getTodayWorkingHours,
    getStatus
} from "./productivity.js";


/* =========================================================
   DOM HELPERS
========================================================= */

function element(id) {

    return document.getElementById(id);

}


/* =========================================================
   DONUT
========================================================= */

function updateDonut(
    donutId,
    hours,
    maxHours = CONFIG.productivity.meterMaxHours
) {
    const donut =
        document.getElementById(donutId);

    if (!donut) return;

    const safeHours =
        Number.isFinite(Number(hours))
            ? Math.max(0, Number(hours))
            : 0;

    const percentage =
        Math.min(
            safeHours / maxHours,
            1
        ) * 100;

    let progressColor;

    if (
        safeHours <
        CONFIG.productivity.targetHours
    ) {
        progressColor = "var(--green)";
    } else if (
        safeHours <
        CONFIG.productivity.excellentHours
    ) {
        progressColor = "var(--green)";
    } else {
        progressColor = "var(--green)";
    }

    const degrees =
        percentage * 3.6;

    donut.style.background = `
        conic-gradient(
            from -90deg,
            ${progressColor} 0deg ${degrees}deg,
            var(--ring) ${degrees}deg 360deg
        )
    `;

    donut.classList.remove(
        "below",
        "on-track",
        "excellent",
        "no-entry"
    );

    if (safeHours <= 0) {
        donut.classList.add("no-entry");
        return;
    }

    if (
        safeHours <
        CONFIG.productivity.targetHours
    ) {
        donut.classList.add("below");
    } else if (
        safeHours <
        CONFIG.productivity.excellentHours
    ) {
        donut.classList.add("on-track");
    } else {
        donut.classList.add("excellent");
    }
}


/* =========================================================
   TODAY DONUT
========================================================= */

function updateTodayDonut(hours) {

    const donut =
        element("today-donut");

    if (!donut) return;

    const todayHours =
        Number.isFinite(Number(hours))
            ? Math.max(0, Number(hours))
            : 0;

    donut.classList.remove(
        "below",
        "on-track",
        "excellent",
        "no-entry"
    );

    /*
     * No entry → completely muted ring.
     */
    if (todayHours <= 0) {

        donut.classList.add("no-entry");

        donut.style.background = `
            conic-gradient(
                from -90deg,
                var(--ring) 0deg 360deg
            )
        `;

        return;
    }

    /*
     * Today uses 8 hrs as the full meter.
     */
    const percentage =
        Math.min(
            todayHours / CONFIG.productivity.targetHours,
            1
        ) * 100;

    const degrees =
        percentage * 3.6;

    /*
     * Today is an activity meter,
     * so logged time uses the dashboard teal.
     */
    donut.style.background = `
        conic-gradient(
            from -90deg,
            var(--green) 0deg ${degrees}deg,
            var(--ring) ${degrees}deg 360deg
        )
    `;

    if (todayHours < 1) {

        donut.classList.add("below");

    } else if (
        todayHours <
        CONFIG.productivity.targetHours
    ) {

        donut.classList.add("on-track");

    } else {

        donut.classList.add("excellent");
    }
}

/* =========================================================
   RENDER TODAY
========================================================= */

function renderToday(hours) {

    const todayHours =
        Number(hours) || 0;

    element("today-hours")
        .textContent =
        todayHours.toFixed(2);

    updateTodayDonut(
        todayHours
    );
}


/* =========================================================
   RENDER NO DATA
========================================================= */

function renderNoData(
    todayHours = 0
) {

    element("average-hours")
        .textContent = "--";


    element("total-hours")
        .textContent = "No data";


    element("days-logged")
        .textContent = "0 days logged";


    const badge =
        element("status-badge");


    badge.textContent =
        "No data";


    badge.className =
        "status-badge";


updateDonut(0);


    updateTodayDisplay(
        todayHours
    );

}


/* =========================================================
   RENDER ERROR
========================================================= */

function renderError() {

    element("average-hours")
        .textContent = "--";


    element("total-hours")
        .textContent =
        "Unable to load";


    element("days-logged")
        .textContent =
        "Try refreshing";


    const badge =
        element("status-badge");


    badge.textContent =
        "Unable to load";


    badge.className =
        "status-badge below";


updateDonut(0);


    updateTodayDisplay(0);

}


/* =========================================================
   MONTHLY AVERAGE TREND
========================================================= */

function renderAverageTrend(issues, currentDate = new Date()) {
    const container = element("average-trend-chart");
    if (!container) return;

    const startYear = CONFIG.productivity.startYear;
    const startMonth = CONFIG.productivity.startMonth;
    const currentIndex = currentDate.getFullYear() * 12 + currentDate.getMonth();
    const startIndex = startYear * 12 + startMonth;
    const months = [];

    for (let index = startIndex; index <= currentIndex; index++) {
        const year = Math.floor(index / 12);
        const month = index % 12;
        const issue = findIssueForMonth(issues, getIssueTitle(year, month));
        const stats = issue ? parseWorkingHours(issue.body, year, month) : emptyProductivity();
        months.push({
            year, month,
            label: new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(year, month, 1)),
            average: stats.daysLogged ? stats.average : null,
            isLive: index === currentIndex
        });
    }

    const completed = months.filter(item => !item.isLive && item.average !== null);
    const live = months[months.length - 1];
    const maxValue = Math.max(8, ...months.map(item => item.average ?? 0));
    const yMax = Math.ceil(maxValue / 2) * 2;
    const width = 620, height = 280;
    const left = 46, right = 22, top = 24, bottom = 48;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const x = index => left + (months.length <= 1 ? plotWidth / 2 : index * plotWidth / (months.length - 1));
    const y = value => top + plotHeight - (value / yMax) * plotHeight;
    const svgNS = "http://www.w3.org/2000/svg";
    const make = (tag, attrs = {}) => {
        const node = document.createElementNS(svgNS, tag);
        for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
        return node;
    };
    const svg = make("svg", { viewBox: `0 0 ${width} ${height}`, class: "average-trend-svg", role: "presentation" });

    for (let tick = 0; tick <= yMax; tick += Math.max(2, yMax / 4)) {
        const tickValue = Math.round(tick * 10) / 10;
        const yy = y(tickValue);
        svg.append(make("line", { x1: left, y1: yy, x2: width - right, y2: yy, class: "trend-gridline" }));
        const label = make("text", { x: left - 12, y: yy + 4, "text-anchor": "end", class: "trend-axis-label" });
        label.textContent = Number.isInteger(tickValue) ? String(tickValue) : tickValue.toFixed(1);
        svg.append(label);
    }

    const yTitle = make("text", { x: 14, y: top + plotHeight / 2, transform: `rotate(-90 14 ${top + plotHeight / 2})`, "text-anchor": "middle", class: "trend-axis-title" });
    yTitle.textContent = "Avg. hrs";
    svg.append(yTitle);

    const completedPoints = completed.map(item => {
        const index = months.indexOf(item);
        return { x: x(index), y: y(item.average), item };
    });
    if (completedPoints.length > 1) {
        const path = completedPoints.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
        svg.append(make("path", { d: path, class: "trend-line" }));
    }

    completedPoints.forEach(point => {
        svg.append(make("circle", { cx: point.x, cy: point.y, r: 5, class: "trend-point" }));
        const value = make("text", { x: point.x, y: point.y - 13, "text-anchor": "middle", class: "trend-value" });
        value.textContent = point.item.average.toFixed(2);
        svg.append(value);
    });

    const liveIndex = months.length - 1;
    const liveAverage = live.average ?? 0;
    const liveX = x(liveIndex);
    const liveY = y(liveAverage);
    const lastCompleted = completedPoints[completedPoints.length - 1];
    if (lastCompleted) {
        svg.append(make("line", { x1: lastCompleted.x, y1: lastCompleted.y, x2: liveX, y2: liveY, class: "trend-projection" }));
    }
    svg.append(make("circle", { cx: liveX, cy: liveY, r: 11, class: "trend-live-halo" }));
    svg.append(make("circle", { cx: liveX, cy: liveY, r: 5.5, class: "trend-live-point" }));
    const liveLabel = make("text", { x: liveX, y: Math.max(top + 12, liveY - 17), "text-anchor": "middle", class: "trend-live-value" });
    liveLabel.textContent = live.average === null ? "0.00*" : liveAverage.toFixed(2) + "*";
    svg.append(liveLabel);

    months.forEach((item, index) => {
        const label = make("text", { x: x(index), y: height - 17, "text-anchor": "middle", class: item.isLive ? "trend-month-label is-live" : "trend-month-label" });
        label.textContent = item.label;
        svg.append(label);
    });

    container.replaceChildren(svg);
    container.setAttribute("aria-label", months.map(item =>
        `${item.label}: ${item.average === null ? "no logged average" : item.average.toFixed(2) + " hours"}`
    ).join("; ") + (live.average === null ? ". Current-month marker is awaiting the first entry." : ". Current-month marker shows the month-to-date average."));
}

/* =========================================================
   RENDER TRACKING
========================================================= */

/* =========================================================
   TODAY DISPLAY
========================================================= */

function updateTodayDisplay(
    hours
) {

    const todayHours =
        Number.isFinite(hours)
            ? hours
            : 0;


    element("today-hours")
        .textContent =
        todayHours.toFixed(2);


    updateTodayDonut(
        todayHours
    );


    const status =
        element("today-status");


    if (todayHours <= 0) {

        status.textContent =
            "No entry today";

        status.className =
            "today-status";

    } else {

        status.textContent =
            `${todayHours.toFixed(2)} hrs logged`;

        status.className =
            "today-status logged";

    }


    const now =
        new Date();


    const formattedDate =
        new Intl.DateTimeFormat(
            "en-GB",
            {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric"
            }
        ).format(now);


    element("today-date")
        .innerHTML =
        `<span class="calendar-icon">▣</span>
         <span>${formattedDate}</span>`;

}

export function renderTracking(
    year,
    month,
    productivity,
    issue,
    todayHours = 0
) {

    element("tracking-month")
        .textContent =
        getMonthLabel(
            year,
            month
        ).toUpperCase();


    /*
     * Today's donut is independent
     * of the selected month.
     *
     * So even when the user is looking
     * at July/August/etc., the second
     * donut continues showing TODAY.
     */

    renderToday(
        todayHours
    );

    updateTodayDisplay(
    todayHours
);


    if (!issue) {

        renderNoData(
            todayHours
        );

        return;

    }


    const average =
        productivity.average;


    const status =
        getStatus(average);


/*
     * Average
     */

    element("average-hours")
        .textContent =
        average.toFixed(2);


    /*
     * Metadata
     */

    element("total-hours")
        .textContent =
        `${productivity.totalHours.toFixed(1)} total hours`;


    element("days-logged")
        .textContent =
        `${productivity.daysLogged} days logged`;


    /*
     * Status
     */

    const badge =
        element("status-badge");


    badge.textContent =
        status.label;


    badge.className =
        `status-badge ${status.className}`;


/*
     * Monthly donut
     */

    updateDonut(
        "donut",
        average
    );

}


/* =========================================================
   LOADING STATE
========================================================= */

function renderLoading(
    year,
    month
) {

    element("tracking-month")
        .textContent =
        getMonthLabel(
            year,
            month
        ).toUpperCase();


    element("average-hours")
        .textContent = "…";


    element("today-hours")
        .textContent = "…";


    updateDonut(
        "donut",
        0
    );


    updateDonut(
        "today-donut",
        0
    );

}


/* =========================================================
   LOAD SELECTED MONTH
========================================================= */

export async function loadTrackingMonth() {

    const requestId =
        ++state.trackingRequestId;


    const year =
        state.selectedYear;


    const month =
        state.selectedMonth;


    renderLoading(
        year,
        month
    );


    try {

        /* =====================================================
           FETCH ISSUES
        ===================================================== */

        const issues =
            await getCachedIssues();


        /*
         * Ignore stale requests.
         */

        if (
            requestId !==
            state.trackingRequestId
        ) {

            return;

        }


        /* =====================================================
           SELECTED MONTH
        ===================================================== */

        const title =
            getIssueTitle(
                year,
                month
            );


        const issue =
            findIssueForMonth(
                issues,
                title
            );


        /* =====================================================
           TODAY
        ===================================================== */

        /*
         * IMPORTANT:
         *
         * `now` is declared ONCE here.
         * Do not declare another `const now`
         * later in this function.
         */

        const now =
            new Date();


        const currentYear =
            now.getFullYear();


        const currentMonth =
            now.getMonth();


        const currentMonthTitle =
            getIssueTitle(
                currentYear,
                currentMonth
            );


        const currentMonthIssue =
            findIssueForMonth(
                issues,
                currentMonthTitle
            );


        const todayHours =
            currentMonthIssue
                ? getTodayWorkingHours(
                    currentMonthIssue.body,
                    now
                )
                : 0;


        /* =====================================================
           STALE REQUEST CHECK
        ===================================================== */

        if (
            requestId !==
            state.trackingRequestId
        ) {

            return;

        }


        /* =====================================================
           PRODUCTIVITY
        ===================================================== */

        const productivity =
            issue

                ? parseWorkingHours(
                    issue.body,
                    year,
                    month
                )

                : emptyProductivity();


        /* =====================================================
           RENDER
        ===================================================== */

        renderTracking(
            year,
            month,
            productivity,
            issue,
            todayHours
        );

        renderAverageTrend(issues, now);


        updateMonthButtons();

    }

    catch (error) {

        console.error(
            "Dashboard error:",
            error
        );


        if (
            requestId !==
            state.trackingRequestId
        ) {

            return;

        }


        renderError();

    }

}


/* =========================================================
   UPDATE MONTH BUTTONS
========================================================= */

export function updateMonthButtons() {

    const previous =
        element("previous-month");


    const next =
        element("next-month");


    const previousMonth =
        normalizeMonth(
            state.selectedYear,
            state.selectedMonth - 1
        );


    const nextMonth =
        normalizeMonth(
            state.selectedYear,
            state.selectedMonth + 1
        );


    previous.disabled =
        isBeforeStart(
            previousMonth.year,
            previousMonth.month
        );


    next.disabled =
        isFutureMonth(
            nextMonth.year,
            nextMonth.month
        );

}


/* =========================================================
   MOVE MONTH
========================================================= */

export function moveMonth(delta) {

    const target =
        normalizeMonth(
            state.selectedYear,
            state.selectedMonth + delta
        );


    if (
        isBeforeStart(
            target.year,
            target.month
        )
    ) {

        return;

    }


    if (
        isFutureMonth(
            target.year,
            target.month
        )
    ) {

        return;

    }


    state.selectedYear =
        target.year;


    state.selectedMonth =
        target.month;


    loadTrackingMonth();

}