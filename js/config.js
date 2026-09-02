export const CONFIG = {

    github: {
        user: "redp4rrot",
        repo: "Arsenal-for-Civil-Services",
        branch: "main"
    },

    productivity: {
        targetHours: 8,
        excellentHours: 9,

        /*
         * June 2026
         *
         * JavaScript months are 0-indexed:
         * January = 0
         * June = 5
         */
        startYear: 2026,
        startMonth: 5,

        /*
         * Donut reaches 100% at 12 hrs/day.
         */
        meterMaxHours: 12
    },

    cache: {
        issueCacheDuration: 60 * 1000
    },

    browser: {

        hiddenFiles: new Set([
            "index.html",
            "dashboard.js",
            "styles.css",
            ".gitkeep",
            ".gitignore",
            "README.md",
            "sh.rc",
            "js"
        ])

    }

};