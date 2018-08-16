async function betterFetch(url) {
    const response = await fetch(url);

    if (response.ok) {
        return response;
    } else {
        throw(`${response.statusText} (${response.status})`);
    }
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const ModPlayer = {
    async init(url) {
        const buffer = await this.loadRawPCM(url);
        this.prepareBuffer(buffer);
    },

    async loadRawPCM(url) {
        // first load raw pcm 44.100/16bit data
        const response = await betterFetch(url);
        const buffer = await response.arrayBuffer();
    
        return buffer;
    },

    prepareBuffer(buffer, sampleSize = 2, sampleRate = 44100, channels = 2) {
        // sampleSize = 2 bytes for 16bit sound
        const frameCount = buffer.byteLength / sampleSize,
            view = new Uint16Array(buffer);

        this.audioBuffer = audioCtx.createBuffer(channels, frameCount, sampleRate);

        for (let channel = 0; channel < channels; channel++) {

            var nowBuffering = this.audioBuffer.getChannelData(channel);
            for (var i = 0; i < frameCount; i++) {
                // audio needs to be in [-1.0; 1.0]
                // for this reason I also tried to divide it by 32767
                // as my pcm sample is in 16-Bit. It plays still the
                // same creepy sound less noisy.
                var word = view[i];
                //(sounds[soundName].charCodeAt(i * 2) & 0xff) + ((sounds[soundName].charCodeAt(i * 2 + 1) & 0xff) << 8);
                nowBuffering[i] = ((word + 32768) % 65536 - 32768) / 32768.0;
            }
        }
        console.log('audiobuffer ready');
    },

    play() {
        if (this.audioBuffer) {
            // Get an AudioBufferSourceNode.
            // This is the AudioNode to use when we want to play an AudioBuffer
            var source = audioCtx.createBufferSource();
            // set the buffer in the AudioBufferSourceNode
            source.buffer = this.audioBuffer;
            // connect the AudioBufferSourceNode to the
            // destination so we can hear the sound
            source.connect(audioCtx.destination);
            // start the source playing
            source.start();
        }
    }
}

ModPlayer.init('audio/yahoo.raw');