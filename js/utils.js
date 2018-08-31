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