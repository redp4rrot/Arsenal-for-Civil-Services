import {
    clearIssueCache
} from "./github.js";

import {
    loadTrackingMonth,
    moveMonth,
    updateMonthButtons
} from "./tracking.js?v=trend-1";

import {
    loadDirectory
} from "./browser.js";

import {
    loadStudyCalendar,
    refreshTodayPlan,
    setupCalendarEvents
} from "./calendar.js?v=local-token-1";


/* =========================================================
   REFRESH
========================================================= */

function refreshDashboard() {

    clearIssueCache();

    loadTrackingMonth();

    loadStudyCalendar(true);

    refreshTodayPlan();

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

function setupThemeToggle() {
    const button = document.getElementById("theme-toggle");
    if (!button) return;
    const stored = (() => { try { return localStorage.getItem("arsenal-theme"); } catch { return null; } })();
    const initial = stored === "light" ? "light" : "dark";

    const apply = theme => {
        document.documentElement.dataset.theme = theme;
        const dark = theme === "dark";
        button.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
        button.setAttribute("title", dark ? "Switch to light theme" : "Switch to dark theme");
        button.classList.toggle("is-dark", dark);
        button.classList.toggle("is-light", !dark);
    };

    apply(initial);
    button.addEventListener("click", () => {
        const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        apply(next);
        try { localStorage.setItem("arsenal-theme", next); } catch { /* Theme still works for this session. */ }
    });
}

export function initializeApp() {

    setupThemeToggle();

    setupEvents();

    setupCalendarEvents();

    updateMonthButtons();

    loadTrackingMonth();

    loadStudyCalendar();

    refreshTodayPlan();

    loadDirectory();

}