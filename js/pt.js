var tickReached = 0;

class PTModule {
    constructor(buffer, mixingRate) {
        this.init();
        this.buffer = buffer;
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

    decodeData() {
        console.log('Decoding module data...');
        this.name = BinUtils.readAscii(this.buffer, 20);

        this.getInstruments();
        this.getPatternData();
        this.getSampleData();
        this.calcTickSpeed();
        this.decodeRow();
        this.ready = true;

        document.dispatchEvent(new Event('module_loaded'));
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
    mix(buffer) {
        for (let i = 0; i < buffer.length; ++i) {
            buffer[i] = 0.0;

            // playing speed test
            this.tick();
            for (let chan = 0; chan < 1; ++chan) {
                const channel = this.channels[chan];
                if (!this.ticks && channel.cmd && !channel.done) {
                    this.executeEffect(channel);
                }
                if (channel.period && !channel.off) {
                    // actually mix audio
                    buffer[i] += this.samples[channel.sample].data[Math.floor(channel.samplePos)];
                    const sampleSpeed = (7093789.2 / (channel.period * 2)) / this.mixingRate;
                    channel.samplePos += sampleSpeed;
                    if (channel.samplePos >= this.samples[channel.sample].length) {
                        // TODO: handle repeat properly
                        channel.samplePos = 0;
                        channel.off = true;
                    }
                }
            }
            this.filledSamples++;
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

                console.log('** next row !', this.row);

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
                sample: (data[0 + offset] & 0xF0 | data[2 + offset] >> 4) - 1,
                period: (data[0 + offset] & 0x0F0) << 8 | data[1 + offset],
                // case 856: notename = "C-1"; break;
                // case 808: notename = "C#1"; break;
                // case 762: notename = "D-1"; break;
                // case 856: notename = "D#1"; break;
                // /* etc */
                // default: notename = "???"; /* This should NOT occur; if it do, it is */
                // /* not a ProTracker module! */
                cmd: data[2 + offset] & 0xF,
                data: data[3 + offset],
                samplePos: 0,
                done: false
            };

            if (note.period) {
                this.channels[i] = note;
            } else if (!this.channels[i]) {
                // empty note as first element
                this.channels[i] = note;
            }
            // effectcommand =* (notedata + 2) & 0xF;
            // effectdata =* (notedata + 3);
            // if effectcommand == 0xE then /* Extended command */ {
            //     extendedcommand = effectdata >> 4;
            //     effectdata &= 0xf; /* Only one nibble data for extended command */
            // }
        }
    }

    executeEffect(channel) {
        Effects[channel.cmd](this, channel);
    }

    getInstruments() {
        this.detectMaxSamples();
        this.samples = new Array();
        // instruments data starts at offset 20
        let offset = 20;
        const uint8buffer = new Uint8Array(this.buffer),
           headerLength = 30;

        for (let i = 0; i < this.maxSamples; ++i) {
            const sample = {
                name: BinUtils.readAscii(this.buffer, 22, offset),
                length: BinUtils.readWord(this.buffer, offset + 22) * 2,
                fintune: uint8buffer[offset + 24] & 0xF0,
                volume: uint8buffer[offset + 25],
                repeatStart: BinUtils.readWord(this.buffer, offset + 26) * 2,
                repeatLength: BinUtils.readWord(this.buffer, offset + 28) * 2,
                data: null
            };
            // Existing mod players seem to do that: legacy stuff ?
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
    }
}