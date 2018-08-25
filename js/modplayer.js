const ModPlayer = {
    context: null,
    mixerNode: null,
    module: null,
    buffer: null,
    mixingRate: 44100,
    playing: false,

    init() {
        this.createContext();
    },

    async loadModule(url) {
        if (!this.context) {
            this.createContext();
        }
        const buffer = await this.loadBinary(url);
        this.module = new PTModule(buffer, this.mixingRate);
        this.module.decodeData();
    },

    async loadBinary(url) {
        // first load raw pcm 44.100/16bit data
        const response = await betterFetch(url);
        const buffer = await response.arrayBuffer();

        return buffer;
    },

    createContext({ bufferlen = 4096 } = {}) {
        console.log('Creating audio context...');
        this.context = new (window.AudioContext || window.webkitAudioContext)();

        this.mixingRate = this.context.sampleRate;

        if (typeof this.context.createJavaScriptNode === 'function') {
            this.mixerNode = this.context.createJavaScriptNode(bufferlen, 1, 1);
        } else {
            this.mixerNode = this.context.createScriptProcessor(bufferlen, 1, 1);
        }

        if (this.mixerNode) {
            this.mixerNode.onaudioprocess = (ape) => this.mix(ape);
            this.mixerNode.connect(this.context.destination);
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

        if (this.playing && this.module) {
            this.module.mix(audioProcessingEvent.outputBuffer.getChannelData(0));
        }
    },

    play() {
        console.log('Playing module...');
        if (this.module) {
            this.playing = true;
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
        console.log('Stopping module...');
        this.playing = false;
    }
}