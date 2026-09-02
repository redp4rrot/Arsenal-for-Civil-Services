import {
    clearIssueCache
} from "./github.js";

import {
    loadTrackingMonth,
    moveMonth,
    updateMonthButtons
} from "./tracking.js";

import {
    loadDirectory
} from "./browser.js";


/* =========================================================
   REFRESH
========================================================= */

function refreshDashboard() {

    clearIssueCache();

    loadTrackingMonth();

    loadDirectory();

}


/* =========================================================
   EVENT LISTENERS
========================================================= */

function setupEvents() {

    /*
     * Previous month
     */

    document
        .getElementById("previous-month")
        .addEventListener(
            "click",
            () => moveMonth(-1)
        );


    /*
     * Next month
     */

    document
        .getElementById("next-month")
        .addEventListener(
            "click",
            () => moveMonth(1)
        );


    /*
     * Refresh
     */

    document
        .getElementById("refresh-btn")
        .addEventListener(
            "click",
            refreshDashboard
        );


    /*
     * Repository navigation.
     *
     * Month navigation does NOT use the hash,
     * so these are completely independent.
     */

    window.addEventListener(
        "hashchange",
        loadDirectory
    );

}


/* =========================================================
   INITIALIZE
========================================================= */

export function initializeApp() {

    setupEvents();

    updateMonthButtons();

    loadTrackingMonth();

    loadDirectory();

}