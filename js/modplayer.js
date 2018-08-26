const ModPlayer = {
    context: null,
    mixerNode: null,
    module: null,
    buffer: null,
    mixingRate: 44100,
    playing: false,
    bufferFull: false,
    ready: true,
    init() {
        this.createContext();
        this.module = new PTModule(this.mixingRate);
    },

    async loadModule(url) {
        if (!this.ready) {
            return;
        } else {
            this.ready = false;
        }

        this.stop();

        if (!this.context) {
            this.createContext();
        }
        const buffer = await this.loadBinary(url);
        this.module.decodeData(buffer);

        this.ready = true;

        document.dispatchEvent(new Event('module_loaded'));
    },

    async loadBinary(url) {
        // first load raw pcm 44.100/16bit data
        const response = await betterFetch(url);
        const buffer = await response.arrayBuffer();

        return buffer;
    },

    createContext({ bufferlen = 2048 } = {}) {
        console.log('Creating audio context...');
        this.context = new (window.AudioContext || window.webkitAudioContext)();

        this.mixingRate = this.context.sampleRate;

        if (typeof this.context.createJavaScriptNode === 'function') {
            this.mixerNode = this.context.createJavaScriptNode(bufferlen, 1, 2);
        } else {
            this.mixerNode = this.context.createScriptProcessor(bufferlen, 1, 2);
        }

        // visualize stuff
        this.analyserNode = this.context.createAnalyser();
        this.amplitudeArray = new Uint8Array(this.analyserNode.frequencyBinCount);
        this.analyserNode.minDecibels = -90;
        this.analyserNode.maxDecibels = -10;

        if (this.mixerNode) {
            this.mixerNode.onaudioprocess = (ape) => this.mix(ape);
            this.mixerNode.connect(this.context.destination);
            this.mixerNode.connect(this.analyserNode);
        }
    },

    mix(audioProcessingEvent) {
        /*
        var outputBuffer = audioProcessingEvent.outputBuffer.getChannelData(0);

        for (var i = 0; i < outputBuffer.length; ++i) {
            if (this.samplePos <= this.sampleLength - 1) {
                outputBuffer[i] = this.buffer[Math.floor(this.samplePos)];
            }
            this.samplePos += this.sampleSpeed;
            if (this.samplePos >= this.sampleLength - 1) {
                this.samplePos = 0;
            }
        }*/

        const buffers = [
            audioProcessingEvent.outputBuffer.getChannelData(0),
            audioProcessingEvent.outputBuffer.getChannelData(1)
        ];

        if (this.playing && this.module) {
            this.bufferFull = true;
            this.module.mix(buffers, audioProcessingEvent.outputBuffer.length);
        } else if (this.bufferFull) {
            this.emptyOutputBuffer(buffers, audioProcessingEvent.outputBuffer.length);
        }

        this.analyserNode.getByteTimeDomainData(this.amplitudeArray);
        if (this.playing) {
             // requestAnimFrame(drawTimeDomain);
            const event = new Event('analyzer_ready');
            event.data = this.amplitudeArray;
            document.dispatchEvent(event);
        }
    },

    emptyOutputBuffer(buffers, length) {
        for (let i = 0; i < length; ++i) {
            buffers[0][i] = 0.0;
            buffers[1][i] = 0.0;
        }
    },

    play() {
        if (this.module && this.module.ready) {
            console.log('Playing module...');
            this.playing = !this.playing;

            if (!this.playing) {
                this.pause();
            }
        } else {
            console.log('Module not ready');
        }
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
        console.log('Stopping playback');
        this.pause();
        if (this.module && this.module.ready) {
            this.module.resetValues();
        }
        // TODO: reset module to start
    },

    pause() {
        console.log('Pausing module...');
        this.playing = false;
    }
}