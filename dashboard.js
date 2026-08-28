/* =========================================================
   CONFIGURATION
   ========================================================= */

const USER = "redp4rrot";
const REPO = "Arsenal-for-Civil-Services";
const BRANCH = "main";

const TARGET_HOURS = 8;
const EXCELLENT_HOURS = 9;
const METER_MAX_HOURS = 10;

/*
 * Tracking started in June 2026.
 *
 * JavaScript months are zero-indexed:
 *
 * January = 0
 * February = 1
 * ...
 * June = 5
 */

const TRACKING_START_YEAR = 2026;
const TRACKING_START_MONTH = 5;

/*
 * Cache key for GitHub planning issues.
 */
const ISSUE_CACHE_KEY =
    "arsenal-planning-issues-v1";


/* =========================================================
   PRODUCTIVITY STATE
   ========================================================= */

let availableMonths = [];
let currentMonthIndex = 0;

/*
 * All planning issues loaded from GitHub.

 * Structure:
 *
 * {
 *   "2026-06": issue,
 *   "2026-07": issue,
 *   "2026-08": issue
 * }
 */

let planningIssues = {};


/* =========================================================
   MONTH UTILITIES
   ========================================================= */

function getMonthInfo(year, month) {

    const date = new Date(year, month, 1);

    const monthName =
        date.toLocaleString("en-US", {
            month: "long"
        });

    return {
        year,
        month,
        monthName,

        key:
            `${year}-${String(month + 1).padStart(2, "0")}`,

        title:
            `Plan the backlog for \`${monthName} ${year}\``
    };
}


function getCurrentMonthInfo() {

    const now = new Date();

    return getMonthInfo(
        now.getFullYear(),
        now.getMonth()
    );
}


/*
 * Generate every month from June 2026
 * up to and including the current month.
 *
 * Example in August 2026:
 *
 * June 2026
 * July 2026
 * August 2026
 */

function getAvailableMonths() {

    const current =
        getCurrentMonthInfo();

    const months = [];

    let year =
        TRACKING_START_YEAR;

    let month =
        TRACKING_START_MONTH;


    while (
        year < current.year ||
        (
            year === current.year &&
            month <= current.month
        )
    ) {

        months.push(
            getMonthInfo(year, month)
        );


        month++;

        if (month > 11) {

            month = 0;
            year++;
        }
    }


    return months;
}


/* =========================================================
   GITHUB ISSUE FETCHING
   ========================================================= */

/*
 * IMPORTANT:
 *
 * We DO NOT use the GitHub Search API here.
 *
 * Previously:
 *
 *     June click   → API search
 *     July click   → API search
 *     August click → API search
 *
 * Rapid switching could therefore trigger GitHub's
 * unauthenticated API rate limit.
 *
 * Now:
 *
 *     Dashboard loads
 *          ↓
 *     Fetch repository issues ONCE
 *          ↓
 *     Extract planning issues locally
 *          ↓
 *     Cache them
 *          ↓
 *     Month switching is completely local
 */


/*
 * Extract month information from an issue title.
 *
 * Expected title:
 *
 * Plan the backlog for `August 2026`
 */

function getMonthFromIssueTitle(title) {

    const pattern =
        /^Plan the backlog for `([A-Za-z]+ \d{4})`$/;

    const match =
        title.match(pattern);

    if (!match) {
        return null;
    }

    const date =
        new Date(`${match[1]} 1`);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return getMonthInfo(
        date.getFullYear(),
        date.getMonth()
    );
}


/*
 * Fetch all repository issues.
 *
 * We use /issues instead of /search/issues.
 *
 * This endpoint is paginated, so we continue until
 * GitHub returns fewer than 100 issues.
 */

async function fetchPlanningIssuesFromGitHub() {

    const issues = [];

    let page = 1;

    while (true) {

        const url =
            `https://api.github.com/repos/${USER}/${REPO}/issues` +
            `?state=all&per_page=100&page=${page}`;

        const response =
            await fetch(url);

        if (!response.ok) {

            throw new Error(
                `GitHub API returned ${response.status}`
            );
        }

        const data =
            await response.json();

        /*
         * GitHub's /issues endpoint can also return
         * pull requests.
         *
         * We only care about actual issues.
         */

        const realIssues =
            data.filter(
                item => !item.pull_request
            );

        issues.push(...realIssues);


        /*
         * Fewer than 100 means we've reached the end.
         */

        if (data.length < 100) {
            break;
        }

        page++;
    }


    /*
     * Convert the issue list into a month-keyed object.
     */

    const result = {};

    issues.forEach(issue => {

        const monthInfo =
            getMonthFromIssueTitle(
                issue.title
            );

        if (!monthInfo) {
            return;
        }

        /*
         * Ignore anything before tracking started.
         */

        if (
            monthInfo.year < TRACKING_START_YEAR ||
            (
                monthInfo.year === TRACKING_START_YEAR &&
                monthInfo.month < TRACKING_START_MONTH
            )
        ) {
            return;
        }


        result[monthInfo.key] = issue;
    });


    return result;
}


/* =========================================================
   ISSUE CACHE
   ========================================================= */

function loadCachedPlanningIssues() {

    try {

        const cached =
            sessionStorage.getItem(
                ISSUE_CACHE_KEY
            );

        if (!cached) {
            return null;
        }

        const parsed =
            JSON.parse(cached);

        if (
            !parsed ||
            typeof parsed !== "object" ||
            !parsed.issues
        ) {
            return null;
        }

        return parsed.issues;

    } catch (error) {

        console.warn(
            "Unable to read issue cache:",
            error
        );

        return null;
    }
}


function saveCachedPlanningIssues(issues) {

    try {

        sessionStorage.setItem(
            ISSUE_CACHE_KEY,
            JSON.stringify({
                issues,
                cachedAt: Date.now()
            })
        );

    } catch (error) {

        /*
         * Caching is only an optimization.
         * If storage fails, the dashboard still works.
         */

        console.warn(
            "Unable to cache planning issues:",
            error
        );
    }
}


/*
 * Load planning issues.
 *
 * Priority:
 *
 * 1. Existing in-memory data
 * 2. sessionStorage
 * 3. GitHub API
 */

async function loadPlanningIssues() {

    /*
     * Already loaded during this page session.
     */

    if (
        Object.keys(planningIssues).length > 0
    ) {
        return planningIssues;
    }


    /*
     * Try browser cache first.
     */

    const cached =
        loadCachedPlanningIssues();

    if (cached) {

        planningIssues =
            cached;

        return planningIssues;
    }


    /*
     * Nothing cached.
     *
     * Make ONE GitHub API operation.
     */

    planningIssues =
        await fetchPlanningIssuesFromGitHub();


    /*
     * Save for the remainder of the
     * browser session.
     */

    saveCachedPlanningIssues(
        planningIssues
    );


    return planningIssues;
}


/*
 * Optional helper for development/testing.
 *
 * If you ever want to force fresh GitHub data from
 * the browser console:
 *
 *     clearPlanningIssueCache()
 *
 * Then refresh the page.
 */

function clearPlanningIssueCache() {

    sessionStorage.removeItem(
        ISSUE_CACHE_KEY
    );

    planningIssues = {};

    console.log(
        "Planning issue cache cleared."
    );
}


/* =========================================================
   WORKLOG PARSER
   ========================================================= */

/*
 * We only care about lines like:
 *
 * _20/08/2026_ **9**
 * _21/08/2026_ **8.5**
 * _22/08/2026_ **7.25**
 *
 * Everything else in the issue is ignored.
 */

function parseWorklog(markdown) {

    const pattern =
        /_(\d{2}\/\d{2}\/\d{4})_\s+\*\*(\d+(?:\.\d+)?)\*\*/g;

    const logs = [];


    for (
        const match of markdown.matchAll(pattern)
    ) {

        const [, date, hours] =
            match;


        logs.push({
            date,
            hours: Number(hours)
        });
    }


    return logs;
}


/* =========================================================
   PRODUCTIVITY CALCULATIONS
   ========================================================= */

function calculateStats(logs) {

    const totalHours =
        logs.reduce(
            (sum, log) =>
                sum + log.hours,
            0
        );


    const daysWorked =
        logs.length;


    const averageHours =
        daysWorked > 0
            ? totalHours / daysWorked
            : 0;


    return {
        totalHours,
        daysWorked,
        averageHours
    };
}


/* =========================================================
   PERFORMANCE STATE
   ========================================================= */

function getPerformanceState(average) {

    if (average < TARGET_HOURS) {

        return {
            className: "below",
            label: "↓ Below target",
            message:
                "Push harder. You've got this."
        };
    }


    if (average <= EXCELLENT_HOURS) {

        return {
            className: "on-track",
            label: "✓ On track",
            message:
                "Good work. Keep the momentum."
        };
    }


    return {
        className: "excellent",
        label: "★ Excellent",
        message:
            "Outstanding. Keep raising the bar."
    };
}


/* =========================================================
   RENDER PRODUCTIVITY DASHBOARD
   ========================================================= */

function renderDashboard(
    stats,
    monthInfo
) {

    const container =
        document.getElementById(
            "productivity-dashboard"
        );


    if (!container) {
        return;
    }


    const average =
        stats.averageHours;


    const performance =
        getPerformanceState(
            average
        );


    /*
     * Meter represents:
     *
     * 0 hrs  = 0%
     * 8 hrs  = 80%
     * 9 hrs  = 90%
     * 10 hrs = 100%
     */

    const percentage =
        Math.min(
            (average / METER_MAX_HOURS) * 100,
            100
        );


    container.innerHTML = `

        <div class="productivity-card ${performance.className}">

            <div class="productivity-header">

                <div>

                    <div class="tracking-label">
                        LIVE TRACKING
                    </div>

                    <div class="productivity-month">
                        ${monthInfo.monthName.toUpperCase()}
                        ${monthInfo.year}
                    </div>

                    <div class="productivity-label">
                        Average working hours / day
                    </div>

                </div>


                <div class="month-navigation">

                    <button
                        class="month-nav-button"
                        id="previous-month"
                        title="Previous month"
                    >
                        ←
                    </button>


                    <button
                        class="month-nav-button"
                        id="next-month"
                        title="Next month"
                    >
                        →
                    </button>

                </div>

            </div>


            <div class="productivity-main">

                <div class="meter-wrapper">

                    <div
                        class="productivity-meter"
                        style="--progress:${percentage}%"
                    >

                        <div class="meter-center">

                            <div class="productivity-average">
                                ${average.toFixed(2)}
                            </div>

                            <div class="meter-unit">
                                hrs/day
                            </div>

                        </div>

                    </div>


                    <div class="target-marker">

                        <span></span>

                        8 hr target

                    </div>

                </div>


                <div class="motivation">

                    <div class="motivation-icon">
                        ✦
                    </div>

                    <div class="motivation-text">
                        ${performance.message}
                    </div>

                </div>

            </div>


            <div class="productivity-meta">

                <span>
                    ${stats.totalHours.toFixed(1)} total hours
                </span>

                <span>•</span>

                <span>
                    ${stats.daysWorked} days logged
                </span>

                <span>•</span>

                <span>
                    Target: ${TARGET_HOURS} hrs/day
                </span>

            </div>

        </div>
    `;


    /*
     * Navigation buttons.
     */

    const previousButton =
        document.getElementById(
            "previous-month"
        );


    const nextButton =
        document.getElementById(
            "next-month"
        );


    previousButton.disabled =
        currentMonthIndex === 0;


    nextButton.disabled =
        currentMonthIndex ===
        availableMonths.length - 1;


    /*
     * Previous month.
     *
     * IMPORTANT:
     *
     * This is now completely local.
     *
     * No GitHub request happens here.
     */

    previousButton.addEventListener(
        "click",
        () => {

            if (
                currentMonthIndex <= 0
            ) {
                return;
            }


            currentMonthIndex--;


            loadDashboardMonth(
                availableMonths[
                    currentMonthIndex
                ]
            );
        }
    );


    /*
     * Next month.
     *
     * Again, completely local.
     */

    nextButton.addEventListener(
        "click",
        () => {

            if (
                currentMonthIndex >=
                availableMonths.length - 1
            ) {
                return;
            }


            currentMonthIndex++;


            loadDashboardMonth(
                availableMonths[
                    currentMonthIndex
                ]
            );
        }
    );
}


/* =========================================================
   LOAD SELECTED MONTH
   ========================================================= */

function loadDashboardMonth(
    monthInfo
) {

    const container =
        document.getElementById(
            "productivity-dashboard"
        );


    if (!container) {
        return;
    }


    /*
     * The issue is ALREADY in memory.
     *
     * This is the important difference from
     * the previous implementation.
     */

    const issue =
        planningIssues[
            monthInfo.key
        ];


    /*
     * No issue for this month.
     */

    if (!issue) {

        renderDashboard(
            {
                totalHours: 0,
                daysWorked: 0,
                averageHours: 0
            },
            monthInfo
        );

        return;
    }


    /*
     * Extract worklog entries.
     */

    const logs =
        parseWorklog(
            issue.body || ""
        );


    /*
     * Calculate statistics.
     */

    const stats =
        calculateStats(logs);


    /*
     * Render.
     */

    renderDashboard(
        stats,
        monthInfo
    );
}


/* =========================================================
   INITIALIZE PRODUCTIVITY TRACKER
   ========================================================= */

async function loadProductivityDashboard() {

    const container =
        document.getElementById(
            "productivity-dashboard"
        );


    if (!container) {
        return;
    }


    container.innerHTML = `
        <div class="productivity-loading">
            Loading productivity...
        </div>
    `;


    try {

        /*
         * Build month list.
         */

        availableMonths =
            getAvailableMonths();


        /*
         * Find current month.
         */

        const current =
            getCurrentMonthInfo();


        currentMonthIndex =
            availableMonths.findIndex(
                month =>
                    month.key ===
                    current.key
            );


        /*
         * Safety fallback.
         */

        if (
            currentMonthIndex === -1
        ) {

            currentMonthIndex =
                availableMonths.length - 1;
        }


        /*
         * IMPORTANT:
         *
         * Fetch planning issues ONCE.
         *
         * After this completes, month
         * switching never talks to GitHub.
         */

        await loadPlanningIssues();


        /*
         * Render current month.
         */

        loadDashboardMonth(
            availableMonths[
                currentMonthIndex
            ]
        );


    } catch (error) {

        console.error(
            "Productivity initialization error:",
            error
        );


        container.innerHTML = `
            <div class="productivity-card productivity-error">
                Unable to load productivity data.
            </div>
        `;
    }
}


/* =========================================================
   REPOSITORY FILE BROWSER
   ========================================================= */

const getPath = () =>
    window.location.hash.replace(
        "#",
        ""
    );


/* =========================================================
   RENDER BROWSER HEADER
   ========================================================= */

function renderHeader(
    path,
    count
) {

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


    bc.innerHTML = "";


    const parts =
        decodeURIComponent(path)
            .split("/")
            .filter(Boolean);


    /*
     * Home
     */

    const home =
        document.createElement("a");


    home.href = "#";
    home.textContent = "Home";


    bc.appendChild(home);


    /*
     * Breadcrumb folders
     */

    let accum = "";


    parts.forEach(
        (p, i) => {

            const sep =
                document.createElement(
                    "span"
                );


            sep.className = "sep";
            sep.textContent = "/";


            bc.appendChild(sep);


            accum +=
                (i ? "/" : "") +
                parts[i];


            const a =
                document.createElement(
                    "a"
                );


            a.href =
                "#" + accum;


            a.textContent =
                p;


            bc.appendChild(a);
        }
    );


    /*
     * Title
     */

    title.textContent =
        parts.length
            ? parts[parts.length - 1]
            : "Arsenal for Civil Services";


    /*
     * Subtitle
     */

    sub.textContent =
        (
            parts.length
                ? parts
                    .slice(0, -1)
                    .join(" / ")
                : "Repository root"
        )
        +
        " • "
        +
        count
        +
        " item"
        +
        (
            count === 1
                ? ""
                : "s"
        );
}


/* =========================================================
   LOAD DIRECTORY
   ========================================================= */

async function loadDirectory() {

    const path =
        getPath();


    const list =
        document.getElementById(
            "file-list"
        );


    list.innerHTML =
        '<div class="loading">Loading…</div>';


    const url =
        `https://api.github.com/repos/${USER}/${REPO}/contents/${path}?ref=${BRANCH}`;


    try {

        const res =
            await fetch(url);


        if (!res.ok) {

            throw new Error(
                "Failed to load repository contents"
            );
        }


        const items =
            await res.json();


        /*
         * Render header.
         */

        renderHeader(
            path,
            items.filter(
                item =>
                    item.name !==
                    "index.html"
            ).length
        );


        list.innerHTML = "";


        /*
         * Go Back tile.
         */

        if (path) {

            const parent =
                path.substring(
                    0,
                    path.lastIndexOf("/")
                );


            const t =
                document.createElement(
                    "a"
                );


            t.className = "tile";


            t.href =
                "#" + parent;


            t.innerHTML = `

                <div class="icon">
                    ←
                </div>

                <div class="name">
                    Go Back
                </div>

                <div class="meta">
                    Parent folder
                </div>

            `;


            list.appendChild(t);
        }


        /*
         * Hidden files.
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


        /*
         * Folders first,
         * then files.
         */

        items.sort(
            (a, b) =>
                a.type === b.type
                    ? a.name.localeCompare(
                        b.name
                    )
                    : a.type === "dir"
                        ? -1
                        : 1
        );


        /*
         * Render items.
         */

        items.forEach(
            item => {

                if (
                    item.name.startsWith(".") ||
                    HIDDEN_FILES.has(
                        item.name
                    )
                ) {
                    return;
                }


                const t =
                    document.createElement(
                        "a"
                    );


                t.className = "tile";


                /*
                 * DIRECTORY
                 */

                if (
                    item.type === "dir"
                ) {

                    t.href =
                        "#" + item.path;


                    t.innerHTML = `

                        <div class="icon">
                            📁
                        </div>

                        <div class="name">
                            ${decodeURIComponent(
                                item.name
                            )}
                        </div>

                        <div class="meta">
                            Folder
                        </div>

                    `;
                }


                /*
                 * FILE
                 */

                else {

                    t.href =
                        `https://${USER}.github.io/${REPO}/${item.path}`;


                    t.target = "_blank";


                    const ext =
                        item.name
                            .split(".")
                            .pop()
                            .toLowerCase();


                    let icon = "📄";


                    if (
                        ext === "pdf"
                    ) {

                        icon = "📕";

                    } else if (
                        [
                            "png",
                            "jpg",
                            "jpeg",
                            "webp",
                            "gif",
                            "svg"
                        ].includes(ext)
                    ) {

                        icon = "🖼️";

                    } else if (
                        [
                            "zip",
                            "rar",
                            "7z"
                        ].includes(ext)
                    ) {

                        icon = "🗜️";
                    }


                    t.innerHTML = `

                        <div class="icon">
                            ${icon}
                        </div>

                        <div class="name">
                            ${decodeURIComponent(
                                item.name
                            )}
                        </div>

                        <div class="meta">
                            ${(item.size / 1024).toFixed(1)} KB
                        </div>

                    `;
                }


                list.appendChild(t);

            }
        );


    } catch (error) {

        console.error(
            "Repository browser error:",
            error
        );


        renderHeader(
            path,
            0
        );


        list.innerHTML = `
            <div class="error">
                Failed to load directory.
            </div>
        `;
    }
}


/* =========================================================
   APPLICATION STARTUP
   ========================================================= */

/*
 * One startup event initializes:
 *
 * 1. Live productivity tracker
 * 2. Repository browser
 */

window.addEventListener(
    "load",
    () => {

        loadProductivityDashboard();

        loadDirectory();

    }
);


/*
 * Hash changes only affect
 * repository navigation.
 */

window.addEventListener(
    "hashchange",
    loadDirectory
);