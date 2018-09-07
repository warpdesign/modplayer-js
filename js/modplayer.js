const ModPlayer = {
    context: null,
    mixerNode: null,
    module: null,
    buffer: null,
    mixingRate: 44100,
    playing: false,
    bufferFull: false,
    ready: true,
    loaded: false,
    init(options) {
        this.canvas = options.canvas;
        this.ctx = this.canvas.getContext('2d');
        this.canvasWidth = (this.canvas.width) / 2;
        this.canvasHeight = this.canvas.height;

        return this.createContext();
    },

    async loadModule(url) {
        if (!this.ready) {
            return;
        } else {
            this.ready = false;
        }

        this.loaded = false;
        this.pause();

        if (!this.context) {
            this.createContext();
        }

        const buffer = await this.loadBinary(url);
        this.postMessage({
            message: 'loadModule',
            buffer: buffer
        });

        this.ready = true;
    },

    async loadBinary(url) {
        const response = await betterFetch(url);
        const buffer = await response.arrayBuffer();

        return buffer;
    },

    createContext() {
        console.log('Creating audio context...');
        this.context = new (window.AudioContext || window.webkitAudioContext)();

        this.mixingRate = this.context.sampleRate;

        return this.context.audioWorklet.addModule('js/mod-processor.js').then(() => {
            this.workletNode = new AudioWorkletNode(this.context, 'mod-processor', {
                outputChannelCount:[2]
            });
            this.workletNode.port.onmessage = this.handleMessage.bind(this);
            this.postMessage({
                message: 'init',
                mixingRate: this.mixingRate
            });
            this.workletNode.port.start();

            this.filterNode = this.context.createBiquadFilter();
            this.filterNode.frequency.value = 22050;

            this.workletNode.connect(this.filterNode);
            this.filterNode.connect(this.context.destination);

            // split channels and connect each channel's output
            // to a separate analyzer
            this.analysisSplitter = this.context.createChannelSplitter(2);
            this.filterNode.connect(this.analysisSplitter);

            this.analyserLeft = this.context.createAnalyser();

            this.analyserLeft.fftSize = Math.pow(2, 11);
            this.analyserLeft.minDecibels = -96;
            this.analyserLeft.maxDecibels = 0;
            this.analyserLeft.smoothingTimeConstant = 0.85;

            this.analyserRight = this.context.createAnalyser();
            this.analyserRight.fftSize = Math.pow(2, 11);
            this.analyserRight.minDecibels = -96;
            this.analyserRight.maxDecibels = 0;
            this.analyserRight.smoothingTimeConstant = 0.85;

            this.analysisSplitter.connect(this.analyserLeft, 0);
            this.analysisSplitter.connect(this.analyserRight, 1);
        });
    },

    setLowPass(activate) {
        this.filterNode.frequency.value = activate && 6000 || 22050;
    },

    handleMessage(message) {
        switch (message.data.message) {
            case 'moduleLoaded':
                this.loaded = true;
                const event = new Event('moduleLoaded');
                event.data = message.data.data;
                document.dispatchEvent(event);
                break;

            case 'toggleLowPass':
                this.setLowPass(message.data.data.activate);
                break;
        }
    },

    postMessage(message) {
        this.workletNode.port.postMessage(message);
    },

    play() {
        if (this.loaded) {
            // probably an iOS device: attempt to unlock webaudio
            if (this.context.state === 'suspended' && 'ontouchstart' in window) {
                this.context.resume();
            }

            console.log('Playing module...');
            this.playing = !this.playing;

            if (!this.playing) {
                this.pause();
            }

            this.sendPlayingStatus();

            this.render();
        } else {
            console.log('No module loaded');
        }
    },

    stop() {
        console.log('Stopping playback');
        this.pause();
        if (this.ready) {
            this.postMessage({
                message: 'reset'
            });
        }

        this.setLowPass(false);
    },

    pause() {
        console.log('Pausing module...');
        this.playing = false;
        this.sendPlayingStatus();
    },

    sendPlayingStatus() {
        this.postMessage({
            message: 'setPlay',
            playing: this.playing
        });
    },

    setPlayingChannels(channels) {
        this.postMessage({
            message: 'setPlayingChannels',
            channels: channels
        });
    },

    render() {
        if (this.playing) {
            this.renderScope();
            requestAnimationFrame(this.render.bind(this));
        }
    },

    /**
     * render adapted from https://github.com/acarabott/audio-dsp-playground (MIT Licence)
     */
    renderScope() {
        const toRender = [
            {
                label: "Left",
                analyser: this.analyserLeft,
                style: "rgba(53, 233, 255, 1)",
                edgeThreshold: 0,
                active: true
            },
            {
                label: "Right",
                analyser: this.analyserRight,
                style: "rgba(53, 233, 255, 1)",
                edgeThreshold: 0,
                active: true
            }];

        this.ctx.fillStyle = "transparent";
        this.ctx.clearRect(0, 0, this.canvasWidth * 2, this.canvasHeight);

        toRender.forEach(({ analyser, style = "rgb(43, 156, 212)", edgeThreshold = 0 }, i) => {
            if (analyser === undefined) { return; }

            const timeData = new Float32Array(analyser.frequencyBinCount);
            let risingEdge = 0;

            analyser.getFloatTimeDomainData(timeData);

            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = style;

            this.ctx.beginPath();

            while (timeData[risingEdge] > 0 &&
                risingEdge <= this.canvasWidth &&
                risingEdge < timeData.length) {
                risingEdge++;
            }

            if (risingEdge >= this.canvasWidth) { risingEdge = 0; }


            while (timeData[risingEdge] < edgeThreshold &&
                risingEdge <= this.canvasWidth &&
                risingEdge < timeData.length) {
                risingEdge++;
            }

            if (risingEdge >= this.canvasWidth) { risingEdge = 0; }

            for (let x = risingEdge; x < timeData.length && x - risingEdge < this.canvasWidth; x++) {
                const y = this.canvasHeight - (((timeData[x] + 1) / 2) * this.canvasHeight);
                this.ctx.lineTo(x - risingEdge + i * this.canvasWidth, y);
            }

            this.ctx.stroke();
        });

        // L/R
        this.ctx.fillStyle = "rgba(255,255,255,0.7)";
        this.ctx.font = "11px Verdana";
        this.ctx.textAlign = "left";
        this.ctx.fillText("L", 5, 15);
        this.ctx.fillText("R", 496, 15);
    }
}