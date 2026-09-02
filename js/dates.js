import { CONFIG } from "./config.js";


/* =========================================================
   MONTH NAME
========================================================= */

export function getMonthName(month) {

    return new Date(
        2000,
        month,
        1
    ).toLocaleString(
        "en-US",
        {
            month: "long"
        }
    );

}


/* =========================================================
   MONTH LABEL
========================================================= */

export function getMonthLabel(year, month) {

    return `${getMonthName(month)} ${year}`;

}


/* =========================================================
   GITHUB ISSUE TITLE
========================================================= */

export function getIssueTitle(year, month) {

    return `Plan the backlog for \`${getMonthLabel(year, month)}\``;

}


/* =========================================================
   BEFORE START
========================================================= */

export function isBeforeStart(year, month) {

    return (

        year < CONFIG.productivity.startYear ||

        (
            year === CONFIG.productivity.startYear &&
            month < CONFIG.productivity.startMonth
        )

    );

}


/* =========================================================
   FUTURE MONTH
========================================================= */

export function isFutureMonth(year, month) {

    const now = new Date();

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return (

        year > currentYear ||

        (
            year === currentYear &&
            month > currentMonth
        )

    );

}


/* =========================================================
   NORMALIZE MONTH
========================================================= */

export function normalizeMonth(year, month) {

    if (month < 0) {

        return {
            year: year - 1,
            month: 11
        };

    }

    if (month > 11) {

        return {
            year: year + 1,
            month: 0
        };

    }

    return {
        year,
        month
    };

}