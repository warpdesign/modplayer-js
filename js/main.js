console.log('hi there !');

async function loadRawPCM(path) {
    // first load raw pcm 44.100/16bit data
    return fetch(path).then((response) => {
        return response.arrayBuffer();
    });
}

const audioBuffer = await loadRawPCM('audio/yahoo.raw');
console.log('finished!', audioBuffer);