async function betterFetch(url) {
    const response = await fetch(url);

    if (response.ok) {
        return response;
    } else {
        throw (`${response.statusText} (${response.status})`);
    }
}

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