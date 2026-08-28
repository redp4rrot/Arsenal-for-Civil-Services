/* =========================================================
   CONFIGURATION
   ========================================================= */

const USER = "redp4rrot";
const REPO = "Arsenal-for-Civil-Services";
const BRANCH = "main";

const TARGET_HOURS = 8;
const EXCELLENT_HOURS = 9;
const METER_MAX_HOURS = 10;


/* =========================================================
   PRODUCTIVITY TRACKER
   ========================================================= */

function getCurrentMonthInfo() {

    const now = new Date();

    const month = now.toLocaleString("en-US", {
        month: "long"
    });

    const year = now.getFullYear();

    return {
        month,
        year,
        title: `Plan the backlog for \`${month} ${year}\``
    };
}


async function findMonthlyIssue() {

    const { title } = getCurrentMonthInfo();

    const query = encodeURIComponent(
        `repo:${USER}/${REPO} is:issue "${title}"`
    );

    const url =
        `https://api.github.com/search/issues?q=${query}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Failed to search GitHub issues");
    }

    const data = await response.json();

    return data.items.find(
        issue => issue.title === title
    );
}


/*
 * Extract only lines like:
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

    for (const match of markdown.matchAll(pattern)) {

        const [, date, hours] = match;

        logs.push({
            date,
            hours: Number(hours)
        });
    }

    return logs;
}


function calculateStats(logs) {

    const totalHours = logs.reduce(
        (sum, log) => sum + log.hours,
        0
    );

    const daysWorked = logs.length;

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


function getPerformanceState(average) {

    if (average < TARGET_HOURS) {

        return {
            className: "below",
            label: "↓ Below target",
            message: "Push harder. You've got this."
        };
    }

    if (average <= EXCELLENT_HOURS) {

        return {
            className: "on-track",
            label: "✓ On track",
            message: "Good work. Keep the momentum."
        };
    }

    return {
        className: "excellent",
        label: "★ Excellent",
        message: "Outstanding. Keep raising the bar."
    };
}


function renderDashboard(stats) {

    const container =
        document.getElementById("productivity-dashboard");

    if (!container) return;

    const { month, year } =
        getCurrentMonthInfo();

    const average =
        stats.averageHours;

    const performance =
        getPerformanceState(average);


    /*
     * Meter represents:
     *
     * 0 hours  → 0%
     * 8 hours  → 80%
     * 9 hours  → 90%
     * 10 hours → 100%
     */

    const percentage = Math.min(
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
                        ${month.toUpperCase()} ${year}
                    </div>

                    <div class="productivity-label">
                        Average working hours / day
                    </div>

                </div>


                <div class="productivity-status">
                    ${performance.label}
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
}


async function loadProductivityDashboard() {

    const container =
        document.getElementById("productivity-dashboard");

    if (!container) return;

    container.innerHTML = `
        <div class="productivity-loading">
            Loading productivity...
        </div>
    `;

    try {

        const issue =
            await findMonthlyIssue();


        if (!issue) {

            container.innerHTML = `
                <div class="productivity-card productivity-error">
                    No worklog found for the current month.
                </div>
            `;

            return;
        }


        const logs =
            parseWorklog(issue.body);


        const stats =
            calculateStats(logs);


        renderDashboard(stats);

    } catch (error) {

        console.error(
            "Productivity dashboard error:",
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
    window.location.hash.replace("#", "");


function renderHeader(path, count) {

    const bc =
        document.getElementById("breadcrumbs");

    const title =
        document.getElementById("title");

    const sub =
        document.getElementById("subtitle");


    bc.innerHTML = "";


    const parts =
        decodeURIComponent(path)
            .split("/")
            .filter(Boolean);


    /*
     * Home breadcrumb
     */

    const home =
        document.createElement("a");

    home.href = "#";
    home.textContent = "Home";

    bc.appendChild(home);


    /*
     * Folder breadcrumbs
     */

    let accum = "";

    parts.forEach((p, i) => {

        const sep =
            document.createElement("span");

        sep.className = "sep";
        sep.textContent = "/";

        bc.appendChild(sep);


        accum +=
            (i ? "/" : "") + parts[i];


        const a =
            document.createElement("a");

        a.href = "#" + accum;
        a.textContent = p;

        bc.appendChild(a);
    });


    /*
     * Page title
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
                ? parts.slice(0, -1).join(" / ")
                : "Repository root"
        )
        +
        " • "
        +
        count
        +
        " item"
        +
        (count === 1 ? "" : "s");
}


async function loadDirectory() {

    const path =
        getPath();

    const list =
        document.getElementById("file-list");


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
         * Update breadcrumb/header
         */

        renderHeader(
            path,
            items.filter(
                i => i.name !== "index.html"
            ).length
        );


        list.innerHTML = "";


        /*
         * Parent directory tile
         */

        if (path) {

            const parent =
                path.substring(
                    0,
                    path.lastIndexOf("/")
                );


            const t =
                document.createElement("a");


            t.className = "tile";

            t.href = "#" + parent;


            t.innerHTML = `
                <div class="icon">←</div>

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
         * Hide internal files
         */

        const HIDDEN_FILES =
            new Set([
                "index.html",
                ".gitkeep",
                ".gitignore",
                "README.md",
                "sh.rc"
            ]);


        /*
         * Folders first, then files.
         */

        items.sort((a, b) =>
            a.type === b.type
                ? a.name.localeCompare(b.name)
                : a.type === "dir"
                    ? -1
                    : 1
        );


        /*
         * Render each repository item.
         */

        items.forEach(item => {

            if (
                item.name.startsWith(".") ||
                HIDDEN_FILES.has(item.name)
            ) {
                return;
            }


            const t =
                document.createElement("a");


            t.className = "tile";


            /*
             * DIRECTORY
             */

            if (item.type === "dir") {

                t.href =
                    "#" + item.path;


                t.innerHTML = `

                    <div class="icon">
                        📁
                    </div>

                    <div class="name">
                        ${decodeURIComponent(item.name)}
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


                if (ext === "pdf") {

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
                        ${decodeURIComponent(item.name)}
                    </div>

                    <div class="meta">
                        ${(item.size / 1024).toFixed(1)} KB
                    </div>

                `;
            }


            list.appendChild(t);

        });


    } catch (error) {

        console.error(
            "Repository browser error:",
            error
        );


        renderHeader(path, 0);


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
 * One load event starts BOTH parts of the application.
 */

window.addEventListener("load", () => {

    loadProductivityDashboard();

    loadDirectory();

});


/*
 * Hash changes only affect the repository browser.
 */

window.addEventListener(
    "hashchange",
    loadDirectory
);