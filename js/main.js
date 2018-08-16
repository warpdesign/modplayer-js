async function betterFetch(url) {
    const response = await fetch(url);

    if (response.ok) {
        return response;
    } else {
        throw(`${response.statusText} (${response.status})`);
    }
}

async function loadRawPCM(url) {
    // first load raw pcm 44.100/16bit data
    const response = await betterFetch(url);
    const buffer = await response.arrayBuffer();

    return buffer;
}

loadRawPCM('audio/yahoo.raw')
.then(buffer => {
    console.log('bufffer', buffer);
})
.catch(e => {
    console.log('Error loading pcm file:', e);
});