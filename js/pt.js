var tickReached = 0;

class PTModule {
    constructor(mixingRate) {
        this.mixingRate = mixingRate;
        // pattern data always starts at offset 1084
        this.patternOffset = 1084;
        this.patternLength = 1024;
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
        this.buffer = null;
        this.started = false;
        this.ready = false;
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
        this.newRow = false;
        this.decodeRow();
    }

    decodeData(buffer) {
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
    mix(buffers, length) {
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
                // if (this.newRow && chan === 1 && this.row === 22 && this.position === 4)
                //     debugger;
                if (this.newRow && channel.cmd && !channel.done) {
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
            this.newRow = false;
        }
    }

    /**
     * Called for each sample inside the output audio buffer
     * This calculates both when to goto next pattern row
     * and sound playback rate
     */
    tick() {
        if (this.filledSamples > this.samplesPerTick) {
            this.ticks++;
            this.filledSamples = 0;
            if (this.ticks >= this.speed) {
                // TO DO: goto next row
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
            console.log('Warning: last position reached, going back to 0');
            this.position = 0;
        } else {
            console.log('// position', this.position, this.pattern);
        }
        this.pattern = this.positions[this.position];
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
                cmd: data[2 + offset] & 0xF,
                data: data[3 + offset],
                samplePos: 0,
                done: false
            };

            // extended command
            if (note.command === 0xE) {
                note.extcmd = note.data >> 4;
                note.data &= 0xF;
            }

            if (note.period) {
                // if a period was selected but no instrument set
                // use the previous one
                if (note.sample === -1) {
                    note.sample = this.channels[i].sample;
                } else {
                    // calculate channel volume once per row only if new sample
                    // so that effect volume is applied during the whole row
                    note.volume = this.samples[note.sample].volume;
                }
                this.channels[i] = note;
            } else if (!this.channels[i]) {
                // empty note as first element
                this.channels[i] = note;
            } else {
                // sample selected but no period
                if (note.sample > -1) {
                    debugger;
                }
                // effects can be applied again
                this.channels[i].done = false;
                this.channels[i].cmd = note.cmd;
                this.channels[i].data = note.data;
            }
        }
        this.newRow = true;
    }

    executeEffect(channel) {
        try {
            Effects[channel.cmd](this, channel);
        } catch (err) {
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
6
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

const Effects = {
    /**
     *
     * Change playback speed
     */
    0xF(Module, channel) {
        Module.speed = channel.data;
        channel.done = true;
    },

    /**
     * Set channel volume
     */
    0xC(Module, channel) {
        console.log('changing volume to', channel.data);
        channel.volume = channel.data;
        channel.done = true;
    }
}