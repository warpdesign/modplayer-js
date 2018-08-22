class PTModule {
    constructor(buffer) {
        this.init();
        this.buffer = buffer;
    }
    init() {
        this.name = '';
        this.length = 0;
        this.type = '';
        this.samples = [];
        this.patterns = [];
        this.positions = [];
        this.songLength = 0;
        this.channels = [];
        this.maxSamples = 0;
        this.bpm = 125;
        this.speed = 6;
        this.position = 0;
        this.buffer = null;
    }
    decodeData() {
        console.log('reading header');
        this.name = BinUtils.readAscii(this.buffer, 20);
        this.getInstruments();
        debugger;
        const offset = this.getPatternData();
        this.getSampleData(offset);
        document.dispatchEvent(new Event('module_loaded'));
    }
    detectMaxSamples() {
        const str = BinUtils.readAscii(this.buffer, 4, 1080);
        this.maxSamples = str.match("M.K.") ? 31 : 15;
    }
   getInstruments() {
        this.detectMaxSamples();
        this.samples = new Array();
        let offset = 20;
        const uint8buffer = new Uint8Array(this.buffer);

        for (let i = 0; i < this.maxSamples; ++i) {
            this.samples.push({
                name: BinUtils.readAscii(this.buffer, 22, offset),
                length: BinUtils.readWord(this.buffer, offset + 22) * 2,
                fintune: uint8buffer[offset + 24] & 0xF0,
                volume: uint8buffer[offset + 25],
                repeatStart: BinUtils.readWord(this.buffer, offset + 26) * 2,
                repeatLength: BinUtils.readWord(this.buffer, offset + 28) * 2,
                data: null
            });
            // sample header is 30 bytes long
            offset += 30;
        }
   }
   getPatternData() {
       const uint8buffer = new Uint8Array(this.buffer, 950);
       this.songLength = uint8buffer[0];
       let position = 2;
       let max = 0;
       const patternLength = 1024;


        for (let i = 0; i < this.songLength; ++i) {
            const pos = uint8buffer[position + i];
            this.positions.push(pos);
            if (pos > max) {
                max = pos;
            }
        }

        position = 1084;

        for (let i = 0; i <= max; ++i) {
            this.patterns.push(this.buffer.slice(position, position + patternLength));
            position += patternLength;
        }

       return position;
    }

    getSampleData(offset) {
        for (let i = 0; i < this.samples.length; ++i) {
            const length = this.samples[i].length,
                data = new Float32Array(this.samples.length),
                pcm = new Int8Array(this.buffer, offset, length);

            for (let j = 0; j < length; ++j) {
                // convert 8bit pcm format to webaudio format
                data[j] = pcm[j] / 128.0;
            }

            this.samples[i].data = data;

            offset += length;
        }
    }
}