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
        this.channels = [];
        this.maxSamples = 0;
        this.bpm = 125;
        this.speed = 6;
        this.position = 0;
        this.buffer = null;
    }
    readHeader() {
        console.log('reading header');
        this.name = BinUtils.readAscii(this.buffer, 20);
        this.getInstruments();
        document.dispatchEvent(new Event('module_loaded'));
    }
    detectMaxSamples() {
        const str = BinUtils.readAscii(this.buffer, 4, 1080);
        this.maxSamples = str.match("M.K.") ? 31 : 15;
    }
    getPatternData() {

    }
    getInstruments() {
        this.detectMaxSamples();
        this.samples = new Array();
        let offset = 20;
        const uint8buffer = new Uint8Array(this.buffer);

        for (let i = 0; i < this.maxSamples; ++i) {
            this.samples.push({
                name: BinUtils.readAscii(this.buffer, 22, offset),
                length: BinUtils.readWord(this.buffer, offset + 22),
                fintune: uint8buffer[offset + 24] & 0xF0,
                volume: uint8buffer[offset + 25],
                repeatStart: BinUtils.readWord(this.buffer, offset + 26) * 2,
                repeatLength: BinUtils.readWord(this.buffer, offset + 28) * 2
            });
            // sample header is 30 bytes long
            offset += 30;
        }
    }
}