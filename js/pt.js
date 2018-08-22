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
        this.channels = [];
        this.maxSamples = 0;
        // These are the default Mod speed/bpm
        this.bpm = 125;
        // number of ticks before playing next pattern row
        this.speed = 6;
        this.position = 0;
        // samples to handle before generating a single tick (50hz)
        this.samplesPerTick = 0;
        this.filledSamples = 0;
        this.ticks = 0;
        this.buffer = null;
    }

    decodeData() {
        console.log('Decoding module data...');
        this.name = BinUtils.readAscii(this.buffer, 20);

        this.getInstruments();
        this.getPatternData();
        this.getSampleData();
        this.calcTickSpeed();

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
            // playing speed test
            this.tick();
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
                console.log('**tick !', tickReached++);
                // TO DO: goto next row
                this.ticks = 0;
            }
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