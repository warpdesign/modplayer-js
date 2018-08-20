async function betterFetch(url) {
    const response = await fetch(url);

    if (response.ok) {
        return response;
    } else {
        throw(`${response.statusText} (${response.status})`);
    }
}

const ModPlayer = {
    context: null,
    mixerNode: null,

    async init(url) {
        this.sampleData = await this.loadRawPCM(url);
        this.createContext();
        this.prepareBuffer(this.sampleData);
        // this.createContext();
        // this.prepareBuffer(buffer);
        // this.prepareBuffer(buffer, {sampleRate:16000});
    },

    async loadRawPCM(url) {
        // first load raw pcm 44.100/16bit data
        const response = await betterFetch(url);
        const buffer = await response.arrayBuffer();

        return buffer;
    },

    createContext({ bufferlen = 4096 } = {}) {
        this.context = new (window.AudioContext || window.webkitAudioContext)();

        this.outputRate = this.context.sampleRate;

        if (typeof this.context.createJavaScriptNode === 'function') {
            this.mixerNode = this.context.createJavaScriptNode(bufferlen, 1, 1);
        } else {
            this.mixerNode = this.context.createScriptProcessor(bufferlen, 1, 1);
        }

        if (this.mixerNode) {
            this.mixerNode.onaudioprocess = (ape) => this.mix(ape);
        }
    },

    mix(audioProcessingEvent) {
        var outputBuffer = audioProcessingEvent.outputBuffer.getChannelData(0);

        for (var i = 0; i < outputBuffer.length; ++i) {
            if (this.samplePos <= this.sampleLength - 1) {
                outputBuffer[i] = this.buffer[Math.floor(this.samplePos)];
            }
            this.samplePos += this.sampleSpeed;
            if (this.samplePos >= this.sampleLength - 1) {
                this.samplePos = 0;
            }
        }
    },

    prepareBuffer(buffer, { sampleSize = 2, sampleRate = 44100, channels = 1 } = {}) {
        // sampleSize = 2 bytes for 16bit sound
        this.sampleLength = buffer.byteLength / sampleSize;

        const view = new Int16Array(buffer);

        // this.audioBuffer = audioCtx.createBuffer(channels, frameCount, sampleRate);

        this.buffer = new Float32Array(this.sampleLength);
        //this.audioBuffer.getChannelData(channel);
        for (var i = 0; i < this.sampleLength; i++) {
            // audio needs to be in [-1.0; 1.0]
            var word = view[i];
            // PCM data is signed, unsigned data would require a conversion: ((word + 32768) % 65536 - 32768)
            this.buffer[i] = word / 32768.0;
        }

        this.samplePos = 0;
        this.sampleSpeed = sampleRate / this.outputRate;

        console.log('audiobuffer ready');
        console.log('outputRate', this.outputRate);
        console.log('sampleSpeed=', this.sampleSpeed)
    },

    play() {
        console.log('playing');
        this.mixerNode.connect(this.context.destination);
        // if (this.audioBuffer) {
        //     // Get an AudioBufferSourceNode.
        //     // This is the AudioNode to use when we want to play an AudioBuffer
        //     var source = audioCtx.createBufferSource();
        //     // set the buffer in the AudioBufferSourceNode
        //     source.buffer = this.audioBuffer;
        //     source.playbackRate.value = 0.5;
        //     // connect the AudioBufferSourceNode to the
        //     // destination so we can hear the sound
        //     source.connect(audioCtx.destination);
        //     // start the source playing
        //     source.start();
        // }
    },

    stop() {
        this.mixerNode.disconnect(this.context.destination);
    }
}

ModPlayer.init('audio/yahoo.raw');

document.addEventListener('keyup', (e) => {
    if (e.keyCode === 107) {
        ModPlayer.sampleSpeed += 0.05;
        console.log('new sampleSpeed', ModPlayer.sampleSpeed);
    } else if (e.keyCode === 109) {
        ModPlayer.sampleSpeed -= 0.05;
        console.log('new sampleSpeed', ModPlayer.sampleSpeed);
    }
});