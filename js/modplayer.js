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
    isXbox: !!navigator.userAgent.match(/Xbox One/),
    init(options) {
        this.canvas = options.canvas;
        this.ctx = this.canvas.getContext('2d');
        this.audioWorkletSupport = options.audioWorkletSupport;
        this.canvasWidth = (this.canvas.width) / 4;
        this.canvasHeight = this.canvas.height;
        this.channels = [true, true, true, true];

        return this.createContext();
    },

    async loadModule(module) {
        if (!this.ready) {
            return;
        } else {
            this.ready = false;
        }

        this.loaded = false;
        this.wasPlaying = this.playing;

        this.pause();

        if (!this.context) {
            this.createContext();
        }

        const buffer = typeof module === 'string' ? await this.loadBinaryFromURL(module) : await this.loadBinaryFromLocalFile(module);
        this.postMessage({
            message: 'loadModule',
            buffer: buffer
        });

        this.ready = true;
    },

    async loadBinaryFromURL(url) {
        const response = await betterFetch(url);
        const buffer = await response.arrayBuffer();

        return buffer;
    },

    async loadBinaryFromLocalFile(file) {
        return new Promise((resolve, reject) => {
            var reader = new FileReader();
            reader.onload = function(e) {
                resolve(e.target.result);
            };
            reader.onerror = function(e) {
                reject('Error : ' + e.type);;
            };
            reader.readAsArrayBuffer(file);
        });
    },

    createContext() {
        console.log('Creating audio context...');
        this.context = new (window.AudioContext || window.webkitAudioContext)();

        this.mixingRate = this.context.sampleRate;

        const soundProcessor = this.isXbox && 'mod-processor-es5.js' || 'mod-processor.js';

        return this.context.audioWorklet.addModule(`js/${soundProcessor}`).then(() => {
            const numAnalysers = this.audioWorkletSupport && 4 || 2;

            // apply a filter
            this.filterNode = this.context.createBiquadFilter();
            this.filterNode.frequency.value = 22050;

            // Use 4 inputs that will be used to send each track's data to a separate analyser
            // NOTE: what should we do if we support more channels (and different mod formats)?
            this.workletNode = new AudioWorkletNode(this.context, 'mod-processor', {
                outputChannelCount: [1, 1, 1, 1],
                numberOfInputs: 0,
                numberOfOutputs: 4
            });

            if (!this.audioWorkletSupport) {
                this.splitter = this.context.createChannelSplitter(numAnalysers);
                this.filterNode.connect(this.splitter);
            }

            this.workletNode.port.onmessage = this.handleMessage.bind(this);
            this.postMessage({
                message: 'init',
                mixingRate: this.mixingRate,
                audioWorkletSupport: this.audioWorkletSupport
            });
            this.workletNode.port.start();

            // create four analysers and connect each worklet's input to one
            this.analysers = new Array();

            for (let i = 0; i < numAnalysers; ++i) {
                const analyser = this.context.createAnalyser();
                analyser.fftSize = 256;// Math.pow(2, 11);
                analyser.minDecibels = -90;
                analyser.maxDecibels = -10;
                analyser.smoothingTimeConstant = 0.65;
                if (this.audioWorkletSupport) {
                    this.workletNode.connect(analyser, i, 0);
                } else {
                    this.splitter.connect(analyser, i);
                }
                this.analysers.push(analyser);
            }

            if (this.audioWorkletSupport) {
                this.merger = this.context.createChannelMerger(2);

                // merge the channel 0+3 in left channel, 1+2 in right channel
                this.workletNode.connect(this.merger, 0, 0);
                this.workletNode.connect(this.merger, 1, 1);
                this.workletNode.connect(this.merger, 2, 1);
                this.workletNode.connect(this.merger, 3, 0);

                // finally apply the lowpass filter and send audio to destination
                this.merger.connect(this.filterNode);
            } else {
                this.workletNode.connect(this.filterNode);
            }


            this.filterNode.connect(this.context.destination);
        });
    },

    setLowPass(activate) {
        this.filterNode.frequency.value = activate && 6000 || 22050;
    },

    setSpeed(speedUp) {
        this.postMessage({
            message: 'speedUp',
            speedUp: speedUp
        });
    },

    handleMessage(message) {
        switch (message.data.message) {
            case 'moduleLoaded': {
                this.loaded = true;
                const event = new Event('moduleLoaded');
                event.data = message.data.data;
                event.data.wasPlaying = this.wasPlaying;
                document.dispatchEvent(event);
                if (!this.playing) {
                    this.renderScope();
                }
            }
            break;

            case 'toggleLowPass':
                this.setLowPass(message.data.data.activate);
                break;

            default: {
                this.loaded = true;
                const event = new Event(message.data.message);
                document.dispatchEvent(event);
            }
        }
    },

    postMessage(message) {
        this.workletNode.port.postMessage(message);
    },

    play() {
        if (this.loaded) {
            // on Safari macOS/iOS, the audioContext is suspended if it's not created
            // in the event handler of a user action: we attempt to resume it.
            if (this.context.state === 'suspended') {
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

        this.channels = channels;

        if (!this.playing) {
            this.renderScope();
        }
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
        let toRender;

        if (this.audioWorkletSupport) {
            toRender = [
                {
                    label: "chan 1",
                    analyser: this.analysers[0],
                    style: "rgba(53, 233, 255, 1)",
                    edgeThreshold: 0,
                    pos: 0,
                },
                {
                    label: "chan 2",
                    analyser: this.analysers[1],
                    style: "rgba(53, 233, 255, 1)",
                    edgeThreshold: 0,
                    pos: 1
                },
                {
                    label: "chan 3",
                    analyser: this.analysers[2],
                    style: "rgba(53, 233, 255, 1)",
                    edgeThreshold: 0,
                    pos: 2
                },
                {
                    label: "chan 4",
                    analyser: this.analysers[3],
                    style: "rgba(53, 233, 255, 1)",
                    edgeThreshold: 0,
                    pos: 3
                }];
        } else {
            toRender = [
                {
                    label: "left",
                    analyser: this.analysers[0],
                    style: "rgba(53, 233, 255, 1)",
                    edgeThreshold: 0,
                    pos: 0
                },
                {
                    label: "right",
                    analyser: this.analysers[1],
                    style: "rgba(53, 233, 255, 1)",
                    edgeThreshold: 0,
                    pos: 3
                }];
        }

        this.ctx.fillStyle = "transparent";
        this.ctx.clearRect(0, 0, this.canvasWidth * 4, this.canvasHeight);

        toRender.forEach(({ analyser, label, style = "rgb(43, 156, 212)", edgeThreshold = 0, pos }, i) => {
            if (analyser === undefined) { return; }


            this.ctx.font = "12px Verdana";
            this.ctx.fillStyle = "rgba(255,255,255,0.8)";
            this.ctx.textAlign = "left";
            // Chan number
            this.ctx.fillText(label, 46 + pos * this.canvasWidth, 15);

            if (!this.channels[i]) {
                this.ctx.font = "18px Arial";
                this.ctx.fillText('MUTE', 40 + pos * this.canvasWidth, 70);
                return;
            }

            const timeData = new Float32Array(analyser.frequencyBinCount);
            let risingEdge = 0;

            analyser.getFloatTimeDomainData(timeData);

            this.ctx.strokeStyle = style;
            this.ctx.fillStyle = style;

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
                this.ctx.fillRect(x - risingEdge + pos * this.canvasWidth, y, 1, 1);
            }
        });
    }
}