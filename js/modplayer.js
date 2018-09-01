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
        this.canvasWidth = (this.canvas.width / devicePixelRatio) / 2;
        this.canvasHeight = this.canvas.height / devicePixelRatio;

        return this.createContext();
        // this.module = new PTModule(this.mixingRate);
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
        // visualize stuff
        // this.analyserNode = this.context.createAnalyser();
        // this.amplitudeArray = new Uint8Array(this.analyserNode.frequencyBinCount);
        // this.analyserNode.minDecibels = -90;
        // this.analyserNode.maxDecibels = -10;

        // if (this.mixerNode) {
        //     this.mixerNode.onaudioprocess = (ape) => this.mix(ape);
        //     this.mixerNode.connect(this.context.destination);
        //     this.mixerNode.connect(this.analyserNode);
        // }
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
            this.workletNode.connect(this.context.destination);

            // split channels and connect each channel's output
            // to a separate analyzer
            this.analysisSplitter = this.context.createChannelSplitter(2);
            this.workletNode.connect(this.analysisSplitter);

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

    handleMessage(message) {
        switch (message.data.message) {
            case 'moduleLoaded':
                this.loaded = true;
                const event = new Event('moduleLoaded');
                event.data = message.data.data;
                document.dispatchEvent(event);
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

    render() {
        // scopeOsc.renderScope(toRender.filter(item => item.active));
        if (this.playing) {
            this.renderScope();
            requestAnimationFrame(this.render.bind(this));
        }
    },

    // array of objects { analyser, strokeStyle, edgeThreshold }
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

        // grid
        this.ctx.fillStyle = "transparent";
        this.ctx.clearRect(0, 0, this.canvasWidth * 2, this.canvasHeight);
        // this.ctx.lineWidth = 1;
        // this.ctx.strokeStyle = "rgba(200, 200, 200, 0.5)";
        // this.ctx.fillStyle = "rgba(200, 200, 200, 0.5)";
        // this.ctx.beginPath();

        const numHorzSteps = 8;

        // **** setter canvaswidth/height
        const horzStep = this.canvasWidth / numHorzSteps;
        // for (let i = horzStep; i < this.canvasWidth; i += horzStep) {
        //     this.ctx.moveTo(i, 0);
        //     this.ctx.lineTo(i, this.canvasHeight);
        // }

        // const numVertSteps = 4;
        // const vertStep = this.canvasHeight / numVertSteps;
        // for (let i = 0; i < this.canvasHeight; i += vertStep) {
        //     this.ctx.moveTo(0, i);
        //     this.ctx.lineTo(this.canvasWidth, i);
        // }
        // this.ctx.stroke();

        // 0 line
        // this.ctx.strokeStyle = "rgba(100, 100, 100, 0.5)";
        // this.ctx.beginPath();
        // this.ctx.lineWidth = 2;
        // this.ctx.moveTo(0, this.canvasHeight / 2);
        // this.ctx.lineTo(this.canvasWidth, this.canvasHeight / 2);
        // this.ctx.stroke();

        // waveforms
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

        // markers
        // this.ctx.fillStyle = "black";
        // this.ctx.font = "11px Courier";
        // this.ctx.textAlign = "left";
        // const numMarkers = 4;
        // const markerStep = this.canvasHeight / numMarkers;
        // for (let i = 0; i <= numMarkers; i++) {
        //     this.ctx.textBaseline = i === 0 ? "top"
        //         : i === numMarkers ? "bottom"
        //             : "middle";

        //     const value = ((numMarkers - i) - (numMarkers / 2)) / numMarkers * 2;
        //     this.ctx.textAlign = "left";
        //     this.ctx.fillText(value, 5, i * markerStep);
        //     this.ctx.textAlign = "right";
        //     this.ctx.fillText(value, this.canvasWidth - 5, i * markerStep);
        // }
    },

    renderSpectrum(analyser) {
        const freqData = new Uint8Array(analyser.frequencyBinCount);

        analyser.getByteFrequencyData(freqData);

        this.ctx.fillStyle = "transparent";
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = "rgb(43, 156, 212)";
        this.ctx.beginPath();

        for (let i = 0; i < freqData.length; i++) {
            const x = (Math.log(i / 1)) / (Math.log(freqData.length / 1)) * this.canvasWidth;
            const height = (freqData[i] * this.canvasHeight) / 256;
            this.ctx.lineTo(x, this.canvasHeight - height);
        }
        this.ctx.stroke();

        const fontSize = 12;

        // frequencies
        function explin(value, inMin, inMax, outMin, outMax) {
            inMin = Math.max(inMin, 1);
            outMin = Math.max(outMin, 1);
            return Math.log10(value / inMin) / Math.log10(inMax / inMin) * (outMax - outMin) + outMin;
        }

        const nyquist = analyser.context.sampleRate / 2;
        [0, 100, 300, 1000, 3000, 10000, 20000].forEach(freq => {
            const minFreq = 20;
            const x = freq <= 0
                ? fontSize - 5
                : explin(freq, minFreq, nyquist, 0, this.canvasWidth);

            this.ctx.fillStyle = "black";
            this.ctx.textBaseline = "middle";
            this.ctx.textAlign = "right";
            this.ctx.font = `${fontSize}px Courier`;
            this.ctx.save();
            this.ctx.translate(x, this.canvasHeight - 5);
            this.ctx.rotate(Math.PI * 0.5);
            this.ctx.fillText(`${freq.toFixed(0)}hz`, 0, 0);
            this.ctx.restore();
        });

        [0, -3, -6, -12].forEach(db => {
            const x = 5;
            const amp = Math.pow(10, db * 0.05);
            const y = (1 - amp) * this.canvasHeight;

            this.ctx.fillStyle = "black";
            this.ctx.textBaseline = "top";
            this.ctx.textAlign = "left";
            this.ctx.font = `${fontSize}px Courier`;
            this.ctx.fillText(`${db.toFixed(0)}db`, x, y);
        });
    }
}