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

function updateDonut(hours) {

    const donut =
        element("donut");


    const percentage =
        Math.min(
            hours /
            CONFIG.productivity.meterMaxHours,
            1
        ) * 100;


    const status =
        getStatus(hours);


    donut.classList.remove(
        "below",
        "on-track",
        "excellent"
    );


    donut.classList.add(
        status.className
    );


    donut.style.setProperty(
        "--progress",
        `${percentage}%`
    );

}


/* =========================================================
   RENDER NO DATA
========================================================= */

function renderNoData() {

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

}


/* =========================================================
   RENDER TRACKING
========================================================= */

export function renderTracking(
    year,
    month,
    productivity,
    issue
) {

    element("tracking-month")
        .textContent =
        getMonthLabel(
            year,
            month
        ).toUpperCase();


    if (!issue) {

        renderNoData();

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
     * Donut
     */

    updateDonut(average);

}


/* =========================================================
   LOADING STATE
========================================================= */

function renderLoading(year, month) {

    element("tracking-month")
        .textContent =
        getMonthLabel(
            year,
            month
        ).toUpperCase();


    element("average-hours")
        .textContent = "…";

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


        /*
         * Again check for stale
         * request after processing.
         */

        if (
            requestId !==
            state.trackingRequestId
        ) {

            return;

        }


        const productivity =
            issue

                ? parseWorkingHours(
                    issue.body,
                    year,
                    month
                )

                : emptyProductivity();


        renderTracking(
            year,
            month,
            productivity,
            issue
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