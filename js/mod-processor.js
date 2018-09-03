const BinUtils = {
    readAscii(buffer, maxLength, offset = 0) {
        const uint8buf = new Uint8Array(buffer);
        // we could have used the new TextDecoder interface, if only
        // it was available in webkit/Safari...
        let str = '',
            eof = false;

        for (let i = 0; i < maxLength, !eof; ++i) {
            const char = uint8buf[offset + i];
            eof = char === 0;
            if (!eof) {
                str += String.fromCharCode(char);
            }
        }

        return str;
    },
    readWord(buffer, offset = 0, littleEndian = false) {
        const view = new DataView(buffer);

        return view.getUint16(offset, littleEndian);
    }
}

const PaulaPeriods = new Float32Array([
    856, 808, 762, 720, 678, 640, 604, 570, 538, 508, 480, 453,
    428, 404, 381, 360, 339, 320, 302, 285, 269, 254, 240, 226,
    214, 202, 190, 180, 170, 160, 151, 143, 135, 127, 120, 113]);

class PTModuleProcessor extends AudioWorkletProcessor{
    constructor() {
        // pattern data always starts at offset 1084
        super();
        this.port.onmessage = this.handleMessage.bind(this);
        this.patternOffset = 1084;
        this.patternLength = 1024;
    }

    handleMessage(event) {
        console.log('[Processor:Received] "' + event.data.message +
            '" (' + event.data.timeStamp + ')');
        switch (event.data.message) {
            case 'init':
                this.mixingRate = event.data.mixingRate;
                break;

            case 'loadModule':
                this.prepareModule(event.data.buffer);
                break;

            case 'setPlay':
                if (this.ready) {
                    this.playing = event.data.playing;
                }
                break;

            case 'reset':
                if (this.ready) {
                    this.resetValues();
                }
        }
    }

    postMessage(message) {
        this.port.postMessage(message);
    }

    process(inputs, outputs, params) {
        if (this.ready && this.playing) {
            this.mix(outputs[0]);
        } else {
            this.emptyOutputBuffer(outputs[0]);
        }

        return true;
    }

    emptyOutputBuffer(buffers) {
        const length = buffers[0].length,
            chans = buffers.length;

        for (let i = 0; i < length; ++i) {
            for (let chan = 0; chan < chans; ++chan) {
                buffers[chan][i] = 0.0;
            }
        }
    }

    init() {
        this.name = '';
        this.samples = [];
        this.patterns = [];
        this.positions = [];
        this.songLength = 0;
        this.channels = new Array(4);
        this.maxSamples = 0;
        // These are the default Mod speed/bpm
        this.bpm = 125;
        // number of ticks before playing next pattern row
        this.speed = 6;
        this.position = 0;
        this.pattern = 0;
        this.row = 0;
        // samples to handle before generating a single tick (50hz)
        this.samplesPerTick = 0;
        this.filledSamples = 0;
        this.ticks = 0;
        this.newTick = true;
        this.buffer = null;
        this.started = false;
        this.ready = false;

        // new for audioworklet
        this.playing = false;
    }

    /**
     * Resets song position to start and speed to default values and decode first row
     */
    resetValues() {
        this.started = false;
        this.position = 0;
        this.row = 0;
        this.ticks = 0;
        this.filledSamples = 0;
        this.speed = 6;
        this.newTick = true;
        this.rowJump = -1;
        this.decodeRow();
    }

    prepareModule(buffer) {
        console.log('Decoding module data...');
        this.ready = false;
        this.init();
        this.buffer = buffer;
        this.name = BinUtils.readAscii(this.buffer, 20);

        this.getInstruments();
        this.getPatternData();
        this.getSampleData();
        this.calcTickSpeed();
        this.resetValues();
        this.ready = true;

        this.postMessage({
            message: 'moduleLoaded',
            data: {
                samples: this.samples,
                title: this.name,
                length: this.buffer.byteLength,
                positions: this.positions.length,
                patterns: this.patterns.length
            }
        });
    }

    detectMaxSamples() {
        // first modules were limited to 15 samples
        // later it was extended to 31 and the 'M.K.'
        // marker was added at offset 1080
        // new module format even use other markers
        // but we stick to good old ST/NT modules
        const str = BinUtils.readAscii(this.buffer, 4, 1080);
        this.maxSamples = str.match("M.K.") ? 31 : 15;
    }

    /**
     * Calculates the number of samples needed
     */
    calcTickSpeed() {
        this.samplesPerTick = ((this.mixingRate * 60) / this.bpm) / 24;
    }

    /**
     * ProTracker audio mixer
     *
     * @param {Float32Array} buffer Output buffer that should be filled with PCM data
     *
     * This method is called each time the buffer should be filled with data
     */
    mix(buffers) {
        const length = buffers[0].length;

        for (let i = 0; i < length; ++i) {
            buffers[0][i] = 0.0;
            buffers[1][i] = 0.0;

            let outputChannel = 0;

            // playing speed test
            this.tick();
            for (let chan = 0; chan < this.channels.length; ++chan) {
                const channel = this.channels[chan];
                // select left/right output depending on module channel:
                // voices 0,3 go to left channel, 1,2 go to right channel
                outputChannel = outputChannel ^ (chan & 1);

                // TODO: check that no effect can be applied without a note
                // otherwise that will have to be moved outside this loop
                if (this.newTick && channel.cmd && !channel.done) {
                    this.executeEffect(channel);
                }

                if (channel.period && !channel.off) {
                    const sample = this.samples[channel.sample];

                    // actually mix audio
                    buffers[outputChannel][i] += (sample.data[Math.floor(channel.samplePos)] * channel.volume) / 64.0;

                    const sampleSpeed = 7093789.2 / ((channel.period * 2) * this.mixingRate);
                    channel.samplePos += sampleSpeed;
                    // repeat samples
                    if (!channel.off) {
                        if (!sample.repeatLength && !sample.repeatStart) {
                            if (channel.samplePos > sample.length) {
                                channel.samplePos = 0;
                                channel.off = true;
                            }
                        } else if (channel.samplePos >= (sample.repeatStart + sample.repeatLength)) {
                            channel.samplePos = sample.repeatStart;
                        }
                    }
                }
            }
            this.filledSamples++;
            this.newTick = false;
        }
    }

    /**
     * Called for each sample inside the output audio buffer
     * This calculates both when to goto next pattern row
     * and sound playback rate
     */
    tick() {
        if (this.rowJump > -1) {
            // TODO: check bounds ?
            this.row = this.rowJump;
            this.decodeRow();
            this.rowJump = -1;
            return;
        }

        if (this.filledSamples > this.samplesPerTick) {
            this.newTick = true;
            this.ticks++;
            this.filledSamples = 0;
            if (this.ticks > this.speed - 1) {
                this.ticks = 0;
                this.row++;
                if (this.row > 63) {
                    this.row = 0;
                    this.getNextPattern(true);
                }

                // console.log('** next row !', this.row.toString(16));

                this.decodeRow();
            }
        }
    }

    getNextPattern(updatePos) {
        updatePos && this.position++;

        // Loop ? Use loop parameter
        if (this.position == this.positions.length - 1) {
            debugger;
            console.log('Warning: last position reached, going back to 0');
            this.position = 0;
        } else {
            // console.log('// position', this.position, this.pattern);
        }
        this.pattern = this.positions[this.position];

        console.log('** position', this.position, 'pattern:', this.pattern);
    }

    decodeRow() {
        if (!this.started) {
            this.started = true;
            this.getNextPattern();
        }

        const pattern = this.patterns[this.pattern];

        const data = new Uint8Array(pattern, this.row * 16, 16);

        for (let i = 0; i < this.channels.length; ++i) {
            const offset = i * 4;
            // depends on command: maybe we don't touch anything
            const note = {
                sample: (data[offset] & 0xF0 | data[2 + offset] >> 4) - 1,
                period: (data[offset] & 0x0F) << 8 | data[1 + offset],
                prevPeriod: this.channels[i] && this.channels[i].period || 0,
                prevData: this.channels[i] && this.channels[i].data,
                cmd: data[2 + offset] & 0xF,
                data: data[3 + offset],
                samplePos: 0,
                done: false
            };

            // extended command
            if (note.cmd === 0xE) {
                // note.extcmd = note.data >> 4;
                note.cmd = 0xE0 + (note.data >> 4);
                note.data &= 0xF;
            }

            // if (!note.cmd && this.channels[i] && this.channels[i].cmd && !this.channels[i].done) {
            //     note.cmd = this.channels[i].cmd;
            // }

            if (note.period) {
                // if a period was selected but no instrument set
                // use the previous one
                if (note.sample === -1) {
                    note.sample = this.channels[i].sample;
                    // use previous volume
                    note.volume = this.channels[i].volume;
                } else {
                    // calculate channel volume once per row only if new sample
                    // so that effect volume is applied during the whole row
                    note.volume = this.samples[note.sample].volume;
                }
                this.channels[i] = note;
            } else if (!this.channels[i]) {
                // empty note as first element
                this.channels[i] = note;
                // Is the default volume set to 64 ??
                note.volume = 64;
            } else {
                // sample selected but no period
                if (note.sample > -1) {
                    debugger;
                }
                // effects can be applied again
                this.channels[i].done = false;
                // avoid endless loop
                if (this.channels[i].cmd !== 0xD) {
                    this.channels[i].cmd = note.cmd;
                    this.channels[i].data = note.data;
                }
            }
        }
    }

    executeEffect(channel) {
        try {
            Effects[channel.cmd](this, channel);
        } catch (err) {
            debugger;
            console.warn(`effect not implemented: ${channel.cmd.toString(16).padStart(2, '0')}/${channel.data.toString(16).padStart(2, '0')}`);
        }
    }

    getInstruments() {
        this.detectMaxSamples();
        this.samples = new Array();
        // instruments data starts at offset 20
        let offset = 20;
        const uint8buffer = new Uint8Array(this.buffer),
            headerLength = 30;

        for (let i = 0; i < this.maxSamples; ++i) {
            // if (i === 16)
            //     debugger;
            const sample = {
                name: BinUtils.readAscii(this.buffer, 22, offset),
                length: BinUtils.readWord(this.buffer, offset + 22) * 2,
                fintune: uint8buffer[offset + 24] & 0xF0,
                volume: uint8buffer[offset + 25],
                repeatStart: BinUtils.readWord(this.buffer, offset + 26) * 2,
                repeatLength: BinUtils.readWord(this.buffer, offset + 28) * 2,
                data: null
            };

            if (sample.finetune) {
                debugger;
            }

            // Existing mod players seem to play a sample only once if repeatLength is set to 2
            if (sample.repeatLength === 2) {
                sample.repeatLength = 0;
            }

            if (sample.repeatLength > sample.length) {
                sample.repeatLength = 0;
                sample.repeatStart = 0;
            }

            this.samples.push(sample);

            offset += headerLength;
        }
    }

    getPatternData() {
        // pattern data always starts at offset 950
        const uint8buffer = new Uint8Array(this.buffer, 950);
        this.songLength = uint8buffer[0];
        let position = 2;
        let max = 0;

        for (let i = 0; i < this.songLength; ++i) {
            const pos = uint8buffer[position + i];
            this.positions.push(pos);
            if (pos > max) {
                max = pos;
            }
        }

        position = this.patternOffset;

        for (let i = 0; i <= max; ++i) {
            this.patterns.push(this.buffer.slice(position, position + this.patternLength));
            position += this.patternLength;
        }
    }

    getSampleData() {
        // samples start right after patterns
        let offset = this.patternOffset + this.patterns.length * this.patternLength;

        for (let i = 0; i < this.samples.length; ++i) {
            const length = this.samples[i].length,
                data = new Float32Array(length),
                pcm = new Int8Array(this.buffer, offset, length);

            // convert 8bit pcm format to webaudio format
            for (let j = 0; j < length; ++j) {
                data[j] = pcm[j] / 128.0;
            }

            this.samples[i].data = data;

            offset += length;
        }
    }
}

registerProcessor('mod-processor', PTModuleProcessor);

const Effects = {
    /**
     * Slide up
     */
    0x1(Module, channel) {
        if (Module.ticks) {
            channel.period -= channel.data;

            if (channel.period < 113) {
                channel.period = 113;
            }
        }
    },
    /**
     * Slide down
     */
    0x2(Module, channel) {
        if (Module.ticks) {
            channel.period += channel.data;

            if (channel.period > 856) {
                channel.period = 856;
            }
        }
    },
    /**
     * Portamento (slide to note)
     */
    0x3(Module, channel) {
        // zero tick: init effect
        if (!Module.ticks) {
            channel.slideTo = channel.period;
            channel.period = channel.prevPeriod;
        } else {
            if (channel.period < channel.slideTo) {
                channel.period += channel.data;
                if (channel.period > channel.slideTo) {
                    channel.period = channel.slideto;
                }
            } else if (channel.period > channel.slideTo) {
                channel.period -= channel.data;
                if (channel.period < channel.slideTo) {
                    channel.period = channel.slideTo;
                }
            }
        }
    },
    /**
     * set sample startOffset
     */
    0x9(Module, channel) {
        if (!Module.ticks) {
            channel.samplePos = channel.data * 256;
            // does it happen on next line ?
            channel.done = true;
        }
    },
    /**
     * Volume slide: happens every non-zero tick
     */
    0xA(Module, channel) {
        // do not execute effect on tick 0
        if (Module.ticks) {
            let x = channel.data & 0xF0,
                y = channel.data & 0xF;

            if (!y) {
                console.log('volume slide', x);
                channel.volume += x;
            } else if (!x) {
                console.log('volume slide', -y);
                channel.volume -= y;
            }

            if (channel.volume > 64) {
                channel.volume = 64;
            } else if (channel.volume < 0) {
                channel.volume = 0;
            }
        }
    },
    /**
     * Position Jump
     */
    0xB(Module, channel) {
        if (channel.data >= 0 && channel.data <= this.patterns.length - 1) {
            // this.position = channel.data;
            debugger;
        }
    },
    /**
      * Set channel volume
      */
    0xC(Module, channel) {
        console.log('changing volume to', channel.data);
        channel.volume = channel.data;
        if (channel.volume > 64) {
            channel.volume = 64;
        }
        // execute effect only once
        channel.done = true;
    },
    /**
     * Row jump
     */
    0xD(Module, channel) {
        if (!Module.ticks) {
            Module.rowJump = ((channel.data & 0xf0) >> 4) * 10 + (channel.data & 0x0f);
            channel.done = true;
        }
    },
    /**
     * Loop pattern
     */
    0xE6(Module, channel) {
        debugger;
        if (channel.data === 0) {
            if (channel.loopCount) {
                channel.loopStart = Module.row;
                channel.loopCount--;
                // last loop
                if (!channel.loopCount) {
                    channel.loopDone = true;
                }
            }
        } else if (!channel.loopDone) {
            if (!channel.loopCount) {
                channel.loopCount = channel.data;
            }

            channel.rowJump = channel.loopStart;
        }
    },
    /**
     * Retrigger note every xxxx ticks
     */
    0xE9(Module, channel) {
        if (!((Module.ticks + 1) % channel.data)) {
            console.log('retriggering note!', Module.ticks + 1);
            // should we use repeat pos (if specified) instead ?)
            channel.samplePos = 0;
            channel.off = false;
        }
    },
    /**
     *
     * Change playback speed
     */
    0xF(Module, channel) {
        if (channel.data < 32) {
            Module.speed = channel.data;
        } else {
            Module.bpm = channel.data;
            this.calcTickSpeed();
        }
        // execute effect only once
        channel.done = true;
    }
}