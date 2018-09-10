async function betterFetch(url) {
    const response = await fetch(url);

    if (response.ok) {
        return response;
    } else {
        throw (`${response.statusText} (${response.status})`);
    }
}

class Deferred {
    /**
     * Creates a new Deferred.
     */
    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }

    /**
     * Creates and immediately resolves a new deferred.
     *
     * @param {any} val the value to resolve the promise with
     *
     *
     */
    static resolve(val) {
        return Promise.resolve(val);
    }
}

/**
 * Simple class to manage Material Lite Toast messages
 */
class Toast {
    /**
     *
     * @param {String} id id of the element to use in the DOM
     */
    constructor(id) {
        this.container = document.getElementById(id);
    }

    /**
     *
     * @param {String} message text to display in the toast
     * @param {Number=2750} timeout timeout in ms
     */
    show(message, timeout = 2750) {
        this.container.MaterialSnackbar.showSnackbar({
            timeout: timeout,
            message: message
        });
    }
}