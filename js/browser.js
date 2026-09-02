import { CONFIG } from "./config.js";


/* =========================================================
   PATH
========================================================= */

export function getPath() {

    return window.location.hash
        .replace("#", "");

}


/* =========================================================
   HEADER
========================================================= */

function renderHeader(
    path,
    count
) {

    const breadcrumbs =
        document.getElementById(
            "breadcrumbs"
        );


    const title =
        document.getElementById(
            "title"
        );


    const subtitle =
        document.getElementById(
            "subtitle"
        );


    const repositorySubtitle =
        document.getElementById(
            "repository-subtitle"
        );


    breadcrumbs.innerHTML = "";


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

    home.textContent =
        "Home";


    breadcrumbs.appendChild(home);


    /*
     * Breadcrumbs
     */

    let accumulated = "";


    parts.forEach(
        (part, index) => {

            const separator =
                document.createElement(
                    "span"
                );


            separator.className =
                "sep";


            separator.textContent =
                "/";


            breadcrumbs.appendChild(
                separator
            );


            accumulated +=
                (index ? "/" : "") +
                part;


            const link =
                document.createElement(
                    "a"
                );


            link.href =
                "#" + accumulated;


            link.textContent =
                part;


            breadcrumbs.appendChild(
                link
            );

        }
    );


    /*
     * Page title
     */

    title.textContent =

        parts.length

            ? parts[parts.length - 1]

            : "Arsenal for Civil Services";


    /*
     * Header subtitle
     */

    subtitle.textContent =

        parts.length

            ? parts
                .slice(0, -1)
                .join(" / ")

            : "Repository root";


    /*
     * Repository subtitle
     */

    repositorySubtitle.textContent =

        parts.length

            ? `${parts.join(" / ")} • ${count} item${count === 1 ? "" : "s"}`

            : `Repository root • ${count} item${count === 1 ? "" : "s"}`;

}


/* =========================================================
   FILE ICON
========================================================= */

function getFileIcon(filename) {

    const extension =
        filename
            .split(".")
            .pop()
            .toLowerCase();


    if (extension === "pdf") {

        return "📕";

    }


    if (

        [
            "png",
            "jpg",
            "jpeg",
            "webp",
            "gif",
            "svg"
        ].includes(extension)

    ) {

        return "🖼️";

    }


    if (

        [
            "zip",
            "rar",
            "7z"
        ].includes(extension)

    ) {

        return "🗜️";

    }


    return "📄";

}


/* =========================================================
   CREATE FILE TILE
========================================================= */

function createFileTile(item) {

    const tile =
        document.createElement("a");


    tile.className =
        "file-tile";


    /*
     * Folder
     */

    if (item.type === "dir") {

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


        return tile;

    }


    /*
     * File
     */

    tile.href =
        `https://${CONFIG.github.user}.github.io/` +
        `${CONFIG.github.repo}/${item.path}`;


    tile.target =
        "_blank";


    tile.rel =
        "noopener";


    const icon =
        getFileIcon(item.name);


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


    return tile;

}


/* =========================================================
   LOAD DIRECTORY
========================================================= */

export async function loadDirectory() {

    const path =
        getPath();


    const list =
        document.getElementById(
            "file-list"
        );


    list.innerHTML =
        '<div class="loading">Loading repository...</div>';


    const url =

        `https://api.github.com/repos/` +
        `${CONFIG.github.user}/` +
        `${CONFIG.github.repo}/contents/` +
        `${path}?ref=${CONFIG.github.branch}`;


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
         * Remove dashboard implementation
         * files from the browser.
         */

        const visibleItems =
            items.filter(
                item =>

                    !item.name.startsWith(".") &&

                    !CONFIG.browser.hiddenFiles
                        .has(item.name)
            );


        renderHeader(
            path,
            visibleItems.length
        );


        list.innerHTML = "";


        /*
         * Parent folder
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

                <div class="file-icon">
                    ←
                </div>

                <div class="file-name">
                    Go Back
                </div>

                <div class="file-meta">
                    Parent folder
                </div>

            `;


            list.appendChild(tile);

        }


        /*
         * Folders first,
         * then files alphabetically.
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


        /*
         * Render
         */

        visibleItems.forEach(
            item => {

                list.appendChild(
                    createFileTile(item)
                );

            }
        );


        /*
         * Empty root.
         */

        if (

            visibleItems.length === 0 &&
            !path

        ) {

            list.innerHTML =
                '<div class="loading">' +
                'No repository files to display.' +
                '</div>';

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
            '<div class="error">' +
            'Failed to load repository.' +
            '</div>';

    }

}