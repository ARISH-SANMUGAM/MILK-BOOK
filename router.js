/**
 * router.js
 * Lightweight hash-based SPA router for MilkBook.
 */

const Router = (() => {
    const routes = {};

    function register(name, handler) {
        routes[name] = handler;
    }

    function navigate(name, params = {}) {
        const hash = params && Object.keys(params).length
            ? `#/${name}?${new URLSearchParams(params).toString()}`
            : `#/${name}`;
        window.location.hash = hash;
    }

    function parseHash() {
        const hash = window.location.hash.replace(/^#\//, "");
        const [path, qs] = hash.split("?");
        const params = {};
        if (qs) {
            new URLSearchParams(qs).forEach((v, k) => { params[k] = v; });
        }
        return { path: path || "login", params };
    }

    function dispatch() {
        const { path, params } = parseHash();
        // Hide all pages
        document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
        const handler = routes[path];
        if (handler) {
            handler(params);
        } else {
            routes["login"]?.({});
        }
    }

    function init() {
        window.addEventListener("hashchange", dispatch);
        dispatch(); // Run on load
    }

    return { register, navigate, init };
})();

window.Router = Router;
