import { CONFIG } from "./config.js";


/* =========================================================
   EMPTY PRODUCTIVITY RESULT
========================================================= */

export function emptyProductivity() {

    return {

        totalHours: 0,

        daysLogged: 0,

        average: 0,

        entries: []

    };

}


/* =========================================================
   PARSE WORKING HOURS
========================================================= */

export function parseWorkingHours(
    body,
    year,
    month
) {

    if (!body) {

        return emptyProductivity();

    }


    const monthNumber =
        String(month + 1)
            .padStart(2, "0");


    /*
     * Expected:
     *
     * _20/08/2026_ **9**
     *
     * Captures:
     *
     * 1 = day
     * 2 = month
     * 3 = year
     * 4 = working hours
     */

    const regex =
        /_(\d{2})\/(\d{2})\/(\d{4})_\s+\*\*(\d+(?:\.\d+)?)\*\*/g;


    const entries = [];

    let match;


    while (
        (match = regex.exec(body)) !== null
    ) {

        const day = match[1];

        const entryMonth = match[2];

        const entryYear = match[3];

        const hours =
            parseFloat(match[4]);


        /*
         * Only accept entries from
         * the selected month.
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
     * Chronological order.
     */

    entries.sort(
        (a, b) => a.day - b.day
    );


    const totalHours =
        entries.reduce(
            (sum, entry) =>
                sum + entry.hours,
            0
        );


    const daysLogged =
        entries.length;


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


/* =========================================================
   PRODUCTIVITY STATUS
========================================================= */

export function getStatus(hours) {

    if (
        hours <
        CONFIG.productivity.targetHours
    ) {

        return {

            label: "↓ Below target",

            className: "below"

        };

    }


    if (
        hours <
        CONFIG.productivity.excellentHours
    ) {

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


/* =========================================================
   MOTIVATION
========================================================= */

export function getMotivation(hours) {

    if (hours === 0) {

        return {

            quote:
                "Start before you feel ready.",

            message:
                "Today is still yours."

        };

    }


    if (hours < 6) {

        return {

            quote:
                "Small steps still move you forward.",

            message:
                "Build the momentum."

        };

    }


    if (hours < 8) {

        return {

            quote:
                "Discipline today, freedom tomorrow.",

            message:
                "Push a little harder."

        };

    }


    if (hours < 9) {

        return {

            quote:
                "Consistency compounds.",

            message:
                "You're on track."

        };

    }


    if (hours < 10) {

        return {

            quote:
                "Excellence is a habit.",

            message:
                "You're doing great."

        };

    }


    return {

        quote:
            "Relentless execution.",

        message:
            "You're operating at another level."

    };

}