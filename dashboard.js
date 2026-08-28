/* ================================================================
   CONFIGURATION
================================================================ */

const USER = "redp4rrot";
const REPO = "Arsenal-for-Civil-Services";
const BRANCH = "main";

const TARGET_HOURS = 8;
const EXCELLENT_HOURS = 9;

const START_YEAR = 2026;
const START_MONTH = 5; // June = 5 because JS months are 0-indexed


/* ================================================================
   STATE
================================================================ */

let selectedYear;
let selectedMonth;

const now = new Date();

selectedYear = now.getFullYear();
selectedMonth = now.getMonth();


/*
   Prevent navigation before June 2026
*/
function isBeforeStart(year, month) {

    return (
        year < START_YEAR ||
        (year === START_YEAR && month < START_MONTH)
    );

}


/*
   Prevent navigating into future months
*/
function isFutureMonth(year, month) {

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return (
        year > currentYear ||
        (year === currentYear && month > currentMonth)
    );

}


/* ================================================================
   MONTH HELPERS
================================================================ */

function getMonthName(month) {

    return new Date(
        2000,
        month,
        1
    ).toLocaleString("en-US", {
        month: "long"
    });

}


function getMonthLabel(year, month) {

    return `${getMonthName(month)} ${year}`;

}


function getIssueTitle(year, month) {

    return `Plan the backlog for \`${getMonthLabel(year, month)}\``;

}


/* ================================================================
   GITHUB API
================================================================ */

/*
   Fetch all issues.

   We deliberately avoid GitHub's search API because the search
   endpoint is much more likely to hit rate limits while switching
   months rapidly.
*/

async function fetchIssues() {

    const issues = [];

    let page = 1;

    while (true) {

        const url =
            `https://api.github.com/repos/${USER}/${REPO}/issues` +
            `?state=all&per_page=100&page=${page}`;

        const response = await fetch(url, {
            cache: "no-store"
        });

        if (!response.ok) {

            throw new Error(
                `GitHub API returned ${response.status}`
            );

        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("Invalid GitHub API response");
        }

        /*
           Pull requests also appear in the issues API.
           We don't need them.
        */

        const realIssues = data.filter(
            issue => !issue.pull_request
        );

        issues.push(...realIssues);

        if (data.length < 100) {
            break;
        }

        page++;

        /*
           Safety limit.
        */
        if (page > 10) {
            break;
        }
    }

    return issues;

}


/* ================================================================
   FIND MONTH ISSUE
================================================================ */

async function findIssueForMonth(year, month, issues = null) {

    const title = getIssueTitle(year, month);

    const allIssues = issues || await fetchIssues();

    return allIssues.find(
        issue => issue.title === title
    ) || null;

}


/* ================================================================
   PARSE PRODUCTIVITY DATA
================================================================ */

/*
   Expected format:

   _20/08/2026_ **9**

   Everything else in the issue is ignored.

   The parser therefore does NOT care about:
   - checkboxes
   - descriptions
   - headings
   - comments
   - other markdown
   - text containing numbers

   It only looks for:

       _DD/MM/YYYY_ **NUMBER**
*/

function parseWorkingHours(body, year, month) {

    if (!body) {

        return {
            totalHours: 0,
            daysLogged: 0,
            average: 0,
            entries: []
        };

    }


    const monthNumber =
        String(month + 1).padStart(2, "0");


    /*
       Capture:

       _20/08/2026_ **9**
    */

    const regex =
        /_(\d{2})\/(\d{2})\/(\d{4})_\s+\*\*(\d+(?:\.\d+)?)\*\*/g;


    const entries = [];

    let match;


    while ((match = regex.exec(body)) !== null) {

        const day = match[1];
        const entryMonth = match[2];
        const entryYear = match[3];
        const hours = parseFloat(match[4]);


        /*
           Only accept the selected month/year.
        */

        if (
            entryYear === String(year) &&
            entryMonth === monthNumber
        ) {

            entries.push({
                day: Number(day),
                hours
            });

        }

    }


    /*
       Sort chronologically.
    */

    entries.sort(
        (a, b) => a.day - b.day
    );


    const totalHours = entries.reduce(
        (sum, entry) => sum + entry.hours,
        0
    );


    const daysLogged = entries.length;


    const average =
        daysLogged > 0
            ? totalHours / daysLogged
            : 0;


    return {
        totalHours,
        daysLogged,
        average,
        entries
    };

}


/* ================================================================
   PRODUCTIVITY STATUS
================================================================ */

function getStatus(hours) {

    if (hours < TARGET_HOURS) {

        return {
            label: "↓ Below target",
            className: "below"
        };

    }

    if (hours < EXCELLENT_HOURS) {

        return {
            label: "→ On track",
            className: "on-track"
        };

    }

    return {
        label: "↑ Excellent",
        className: "excellent"
    };

}


/* ================================================================
   MOTIVATION
================================================================ */

function getMotivation(hours) {

    if (hours === 0) {

        return {
            quote: "Start before you feel ready.",
            message: "Today is still yours."
        };

    }


    if (hours < 6) {

        return {
            quote: "Small steps still move you forward.",
            message: "Build the momentum."
        };

    }


    if (hours < 8) {

        return {
            quote: "Discipline today, freedom tomorrow.",
            message: "Push a little harder."
        };

    }


    if (hours < 9) {

        return {
            quote: "Consistency compounds.",
            message: "You're on track."
        };

    }


    if (hours < 10) {

        return {
            quote: "Excellence is a habit.",
            message: "You're doing great."
        };

    }


    return {
        quote: "Relentless execution.",
        message: "You're operating at another level."
    };

}


/* ================================================================
   DONUT
================================================================ */

function updateDonut(hours) {

    const donut =
        document.getElementById("donut");


    /*
       The visual scale is based around 12 hours.

       This means:

       8 hrs  -> 66.7%
       9 hrs  -> 75%
       12 hrs -> 100%

       Anything beyond 12 remains visually full.
    */

    const percentage =
        Math.min(hours / 12, 1) * 100;


    const status = getStatus(hours);


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


/* ================================================================
   RENDER TRACKING
================================================================ */

function renderTracking(
    year,
    month,
    productivity,
    issue
) {

    const monthLabel =
        getMonthLabel(year, month);


    document.getElementById(
        "tracking-month"
    ).textContent =
        monthLabel.toUpperCase();


    /*
       No issue / no data
    */

    if (!issue) {

        document.getElementById(
            "average-hours"
        ).textContent = "--";


        document.getElementById(
            "total-hours"
        ).textContent =
            "No data";


        document.getElementById(
            "days-logged"
        ).textContent =
            "0 days logged";


        document.getElementById(
            "status-badge"
        ).textContent =
            "No data";


        document.getElementById(
            "status-badge"
        ).className =
            "status-badge";


        document.getElementById(
            "motivation-quote"
        ).textContent =
            "Your next chapter starts here.";


        document.getElementById(
            "motivation-message"
        ).textContent =
            "Log your first day.";


        updateDonut(0);

        return;

    }


    const average =
        productivity.average;


    const status =
        getStatus(average);


    const motivation =
        getMotivation(average);


    /*
       Average
    */

    document.getElementById(
        "average-hours"
    ).textContent =
        average.toFixed(2);


    /*
       Footer
    */

    document.getElementById(
        "total-hours"
    ).textContent =
        `${productivity.totalHours.toFixed(1)} total hours`;


    document.getElementById(
        "days-logged"
    ).textContent =
        `${productivity.daysLogged} days logged`;


    /*
       Status
    */

    const statusBadge =
        document.getElementById(
            "status-badge"
        );


    statusBadge.textContent =
        status.label;


    statusBadge.className =
        `status-badge ${status.className}`;


    /*
       Motivation
    */

    document.getElementById(
        "motivation-quote"
    ).textContent =
        motivation.quote;


    document.getElementById(
        "motivation-message"
    ).textContent =
        motivation.message;


    /*
       Donut
    */

    updateDonut(average);

}


/* ================================================================
   LOAD PRODUCTIVITY
================================================================ */

let issueCache = null;
let issueCacheTimestamp = 0;

const ISSUE_CACHE_TIME = 60 * 1000;


/*
   Cache the issue list for 1 minute.

   This is important because rapidly pressing
   ← → ← → should NOT fire a GitHub request every time.
*/

async function getCachedIssues() {

    const nowTime = Date.now();


    if (
        issueCache &&
        nowTime - issueCacheTimestamp < ISSUE_CACHE_TIME
    ) {

        return issueCache;

    }


    issueCache = await fetchIssues();

    issueCacheTimestamp = nowTime;


    return issueCache;

}


let trackingRequestId = 0;


async function loadDashboardMonth() {

    const requestId =
        ++trackingRequestId;


    const year = selectedYear;
    const month = selectedMonth;


    /*
       Show loading state.
    */

    document.getElementById(
        "tracking-month"
    ).textContent =
        getMonthLabel(
            year,
            month
        ).toUpperCase();


    document.getElementById(
        "average-hours"
    ).textContent =
        "…";


    try {

        const issues =
            await getCachedIssues();


        /*
           User may have clicked another month
           while the request was running.

           Ignore this stale response.
        */

        if (
            requestId !== trackingRequestId
        ) {
            return;
        }


        const issue =
            await findIssueForMonth(
                year,
                month,
                issues
            );


        if (
            requestId !== trackingRequestId
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
                : {
                    totalHours: 0,
                    daysLogged: 0,
                    average: 0,
                    entries: []
                };


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
            requestId !== trackingRequestId
        ) {
            return;
        }


        document.getElementById(
            "average-hours"
        ).textContent =
            "--";


        document.getElementById(
            "status-badge"
        ).textContent =
            "Unable to load";


        document.getElementById(
            "status-badge"
        ).className =
            "status-badge below";


        document.getElementById(
            "motivation-quote"
        ).textContent =
            "Unable to load productivity data.";


        document.getElementById(
            "motivation-message"
        ).textContent =
            "Try refreshing in a moment.";

    }

}


/* ================================================================
   MONTH NAVIGATION
================================================================ */

function updateMonthButtons() {

    const previous =
        document.getElementById(
            "previous-month"
        );


    const next =
        document.getElementById(
            "next-month"
        );


    /*
       Previous button
    */

    previous.disabled =
        isBeforeStart(
            selectedYear,
            selectedMonth - 1
        );


    /*
       Next button
    */

    next.disabled =
        isFutureMonth(
            selectedYear,
            selectedMonth + 1
        );

}


function moveMonth(delta) {

    let year = selectedYear;
    let month = selectedMonth + delta;


    if (month < 0) {

        month = 11;
        year--;

    }


    if (month > 11) {

        month = 0;
        year++;

    }


    /*
       Don't allow months before June 2026.
    */

    if (
        isBeforeStart(
            year,
            month
        )
    ) {
        return;
    }


    /*
       Don't allow future months.
    */

    if (
        isFutureMonth(
            year,
            month
        )
    ) {
        return;
    }


    selectedYear = year;
    selectedMonth = month;


    loadDashboardMonth();

}


/* ================================================================
   FILE BROWSER
================================================================ */

const getPath = () =>
    window.location.hash.replace("#", "");


/*
   Files that belong to the dashboard itself.

   They should exist in the repository but NOT appear
   inside the repository browser.
*/

const HIDDEN_FILES = new Set([
    "index.html",
    "dashboard.js",
    "styles.css",
    ".gitkeep",
    ".gitignore",
    "README.md",
    "sh.rc"
]);


/* ================================================================
   HEADER
================================================================ */

function renderHeader(path, count) {

    const bc =
        document.getElementById(
            "breadcrumbs"
        );


    const title =
        document.getElementById(
            "title"
        );


    const sub =
        document.getElementById(
            "subtitle"
        );


    const repositorySub =
        document.getElementById(
            "repository-subtitle"
        );


    bc.innerHTML = "";


    const parts =
        decodeURIComponent(path)
            .split("/")
            .filter(Boolean);


    const home =
        document.createElement("a");


    home.href = "#";
    home.textContent = "Home";


    bc.appendChild(home);


    let accum = "";


    parts.forEach((part, index) => {

        const sep =
            document.createElement(
                "span"
            );


        sep.className = "sep";
        sep.textContent = "/";


        bc.appendChild(sep);


        accum +=
            (index ? "/" : "") +
            part;


        const a =
            document.createElement(
                "a"
            );


        a.href = "#" + accum;
        a.textContent = part;


        bc.appendChild(a);

    });


    title.textContent =
        parts.length
            ? parts[parts.length - 1]
            : "Arsenal for Civil Services";


    sub.textContent =
        parts.length
            ? parts.slice(0, -1).join(" / ")
            : "Repository root";


    repositorySub.textContent =
        parts.length
            ? `${parts.join(" / ")} • ${count} item${count === 1 ? "" : "s"}`
            : `Repository root • ${count} item${count === 1 ? "" : "s"}`;

}


/* ================================================================
   LOAD DIRECTORY
================================================================ */

async function loadDirectory() {

    const path =
        getPath();


    const list =
        document.getElementById(
            "file-list"
        );


    list.innerHTML =
        '<div class="loading">Loading repository...</div>';


    const url =
        `https://api.github.com/repos/${USER}/${REPO}/contents/${path}?ref=${BRANCH}`;


    try {

        const response =
            await fetch(url);


        if (!response.ok) {

            throw new Error(
                `GitHub returned ${response.status}`
            );

        }


        const items =
            await response.json();


        /*
           Only visible files are counted.
        */

        const visibleItems =
            items.filter(
                item =>
                    !item.name.startsWith(".") &&
                    !HIDDEN_FILES.has(item.name)
            );


        renderHeader(
            path,
            visibleItems.length
        );


        list.innerHTML = "";


        /*
           Parent directory
        */

        if (path) {

            const parent =
                path.substring(
                    0,
                    path.lastIndexOf("/")
                );


            const tile =
                document.createElement("a");


            tile.className =
                "file-tile back-tile";


            tile.href =
                "#" + parent;


            tile.innerHTML = `
                <div class="file-icon">←</div>
                <div class="file-name">Go Back</div>
                <div class="file-meta">Parent folder</div>
            `;


            list.appendChild(tile);

        }


        /*
           Sort:

           folders first
           then files alphabetically
        */

        visibleItems.sort(
            (a, b) => {

                if (a.type === b.type) {

                    return a.name.localeCompare(
                        b.name
                    );

                }

                return a.type === "dir"
                    ? -1
                    : 1;

            }
        );


        visibleItems.forEach(
            item => {

                const tile =
                    document.createElement(
                        "a"
                    );


                tile.className =
                    "file-tile";


                if (
                    item.type === "dir"
                ) {

                    tile.href =
                        "#" + item.path;


                    tile.innerHTML = `
                        <div class="file-icon folder-icon">
                            📁
                        </div>

                        <div class="file-name">
                            ${decodeURIComponent(item.name)}
                        </div>

                        <div class="file-meta">
                            Folder
                        </div>
                    `;

                }
                else {

                    tile.href =
                        `https://${USER}.github.io/${REPO}/${item.path}`;


                    tile.target =
                        "_blank";


                    tile.rel =
                        "noopener";


                    const extension =
                        item.name
                            .split(".")
                            .pop()
                            .toLowerCase();


                    let icon =
                        "📄";


                    if (
                        extension === "pdf"
                    ) {

                        icon = "📕";

                    }
                    else if (
                        [
                            "png",
                            "jpg",
                            "jpeg",
                            "webp",
                            "gif",
                            "svg"
                        ].includes(extension)
                    ) {

                        icon = "🖼️";

                    }
                    else if (
                        [
                            "zip",
                            "rar",
                            "7z"
                        ].includes(extension)
                    ) {

                        icon = "🗜️";

                    }


                    tile.innerHTML = `
                        <div class="file-icon">
                            ${icon}
                        </div>

                        <div class="file-name">
                            ${decodeURIComponent(item.name)}
                        </div>

                        <div class="file-meta">
                            ${(item.size / 1024).toFixed(1)} KB
                        </div>
                    `;

                }


                list.appendChild(tile);

            }
        );


        /*
           Empty directory
        */

        if (
            visibleItems.length === 0 &&
            !path
        ) {

            list.innerHTML =
                '<div class="loading">No repository files to display.</div>';

        }

    }
    catch (error) {

        console.error(
            "Repository error:",
            error
        );


        renderHeader(
            path,
            0
        );


        list.innerHTML =
            '<div class="error">Failed to load repository.</div>';

    }

}


/* ================================================================
   REFRESH
================================================================ */

function refreshDashboard() {

    /*
       Clear issue cache so Refresh actually
       gets the newest GitHub issue data.
    */

    issueCache = null;
    issueCacheTimestamp = 0;


    loadDashboardMonth();
    loadDirectory();

}


/* ================================================================
   EVENTS
================================================================ */

document
    .getElementById("previous-month")
    .addEventListener(
        "click",
        () => moveMonth(-1)
    );


document
    .getElementById("next-month")
    .addEventListener(
        "click",
        () => moveMonth(1)
    );


document
    .getElementById("refresh-btn")
    .addEventListener(
        "click",
        refreshDashboard
    );


window.addEventListener(
    "hashchange",
    loadDirectory
);


/* ================================================================
   INITIALIZE
================================================================ */

window.addEventListener(
    "load",
    () => {

        updateMonthButtons();

        loadDashboardMonth();

        loadDirectory();

    }
);