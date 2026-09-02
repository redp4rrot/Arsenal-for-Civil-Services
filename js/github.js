import { CONFIG } from "./config.js";
import { state } from "./state.js";


/* =========================================================
   GITHUB API
========================================================= */

const API_BASE =
    `https://api.github.com/repos/` +
    `${CONFIG.github.user}/` +
    `${CONFIG.github.repo}`;


/* =========================================================
   FETCH ISSUES
========================================================= */

export async function fetchIssues() {

    const url =
        `${API_BASE}/issues` +
        `?state=all` +
        `&per_page=100` +
        `&page=1`;


    const controller =
        new AbortController();


    /*
     * Do not let the dashboard remain on
     * "Loading..." forever if GitHub does not respond.
     */

    const timeout =
        setTimeout(
            () => controller.abort(),
            10000
        );


    try {

        const response =
            await fetch(
                url,
                {
                    cache: "no-store",
                    signal: controller.signal,
                    headers: {
                        Accept:
                            "application/vnd.github+json"
                    }
                }
            );


        if (!response.ok) {

            if (response.status === 403) {

                throw new Error(
                    "GitHub API rate limit exceeded. Try again later."
                );

            }


            throw new Error(
                `GitHub API returned ${response.status}`
            );

        }


        const data =
            await response.json();


        if (!Array.isArray(data)) {

            throw new Error(
                "Invalid GitHub API response"
            );

        }


        /*
         * GitHub's Issues API also returns
         * pull requests.
         */

        return data.filter(
            issue => !issue.pull_request
        );

    }

    catch (error) {

        if (
            error.name ===
            "AbortError"
        ) {

            throw new Error(
                "GitHub API request timed out."
            );

        }


        throw error;

    }

    finally {

        clearTimeout(timeout);

    }

}


/* =========================================================
   CACHED ISSUES
========================================================= */

export async function getCachedIssues(
    forceRefresh = false
) {

    const currentTime =
        Date.now();


    /*
     * Normal cache hit.
     */

    if (
        !forceRefresh &&
        state.issueCache &&
        (
            currentTime -
            state.issueCacheTimestamp
        ) <
        CONFIG.cache.issueCacheDuration
    ) {

        return state.issueCache;

    }


    /*
     * If another request is already running,
     * reuse it.
     */

    if (state.issueFetchPromise) {

        return state.issueFetchPromise;

    }


    state.issueFetchPromise =
        fetchIssues();


    try {

        const issues =
            await state.issueFetchPromise;


        state.issueCache =
            issues;


        state.issueCacheTimestamp =
            Date.now();


        return issues;

    }

    finally {

        state.issueFetchPromise =
            null;

    }

}


/* =========================================================
   FIND ISSUE FOR MONTH
========================================================= */

export function findIssueForMonth(
    issues,
    issueTitle
) {

    return (
        issues.find(
            issue =>
                issue.title ===
                issueTitle
        ) || null
    );

}


/* =========================================================
   CLEAR CACHE
========================================================= */

export function clearIssueCache() {

    state.issueCache =
        null;

    state.issueCacheTimestamp =
        0;

}