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
    getStatus,
    getMotivation
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
        progressColor = "#ff6b73";
    } else if (
        safeHours <
        CONFIG.productivity.excellentHours
    ) {
        progressColor = "#f5b72f";
    } else {
        progressColor = "#6ed0c5";
    }

    const degrees =
        percentage * 3.6;

    donut.style.background = `
        conic-gradient(
            from -90deg,
            ${progressColor} 0deg ${degrees}deg,
            #344152 ${degrees}deg 360deg
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
            var(--teal) 0deg ${degrees}deg,
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


    element("motivation-quote")
        .textContent =
        "Your next chapter starts here.";


    element("motivation-message")
        .textContent =
        "Log your first day.";


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


    element("motivation-quote")
        .textContent =
        "Unable to load productivity data.";


    element("motivation-message")
        .textContent =
        "Try refreshing in a moment.";


    updateDonut(0);


    updateTodayDisplay(0);

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


    const motivation =
        getMotivation(average);


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
     * Motivation
     */

    element("motivation-quote")
        .textContent =
        motivation.quote;


    element("motivation-message")
        .textContent =
        motivation.message;


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