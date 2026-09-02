import { CONFIG } from "./config.js";
import { state } from "./state.js";


/* =========================================================
   GITHUB API BASE
========================================================= */

const API_BASE =
    `https://api.github.com/repos/` +
    `${CONFIG.github.user}/` +
    `${CONFIG.github.repo}`;


/* =========================================================
   FETCH ALL ISSUES
========================================================= */

export async function fetchIssues() {

    const issues = [];

    let page = 1;

    while (true) {

        const url =
            `${API_BASE}/issues` +
            `?state=all` +
            `&per_page=100` +
            `&page=${page}`;

        const response = await fetch(
            url,
            {
                cache: "no-store"
            }
        );


        if (!response.ok) {

            throw new Error(
                `GitHub API returned ${response.status}`
            );

        }


        const data = await response.json();


        if (!Array.isArray(data)) {

            throw new Error(
                "Invalid GitHub API response"
            );

        }


        /*
         * GitHub's Issues API also returns
         * pull requests.
         */
        const realIssues =
            data.filter(
                issue => !issue.pull_request
            );


        issues.push(...realIssues);


        if (data.length < 100) {
            break;
        }


        page++;


        /*
         * Safety limit.
         */
        if (page > 10) {
            break;
        }

    }


    return issues;

}


/* =========================================================
   CACHED ISSUES
========================================================= */

export async function getCachedIssues(
    forceRefresh = false
) {

    const currentTime = Date.now();


    /*
     * Normal cache hit.
     */
    if (

        !forceRefresh &&

        state.issueCache &&

        currentTime -
        state.issueCacheTimestamp <
        CONFIG.cache.issueCacheDuration

    ) {

        return state.issueCache;

    }


    /*
     * If a fetch is already happening,
     * reuse it.
     *
     * This is particularly useful when the
     * user rapidly switches months.
     */
    if (state.issueFetchPromise) {

        return state.issueFetchPromise;

    }


    state.issueFetchPromise =
        fetchIssues();


    try {

        const issues =
            await state.issueFetchPromise;


        state.issueCache = issues;

        state.issueCacheTimestamp =
            Date.now();


        return issues;

    }
    finally {

        state.issueFetchPromise = null;

    }

}


/* =========================================================
   FIND MONTH ISSUE
========================================================= */

export function findIssueForMonth(
    issues,
    issueTitle
) {

    return (

        issues.find(
            issue => issue.title === issueTitle
        ) || null

    );

}


/* =========================================================
   CLEAR CACHE
========================================================= */

export function clearIssueCache() {

    state.issueCache = null;

    state.issueCacheTimestamp = 0;

}