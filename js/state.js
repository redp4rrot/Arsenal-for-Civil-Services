import { CONFIG } from "./config.js";

const now = new Date();

export const state = {

    selectedYear: now.getFullYear(),

    selectedMonth: now.getMonth(),

    issueCache: null,

    issueCacheTimestamp: 0,

    /*
     * If multiple requests happen at the same time,
     * they share this promise instead of making
     * multiple GitHub requests.
     */
    issueFetchPromise: null,

    /*
     * Used to ignore stale month requests.
     *
     * Example:
     *
     * User clicks:
     * August → July → June
     *
     * If August's request finishes last,
     * it must NOT overwrite June.
     */
    trackingRequestId: 0

};