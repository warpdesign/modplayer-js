var moduleList = [
    { file: 'agony.mod', author: 'Tim Wright' },
    { file: 'all_that_she_wants.mod', author: 'Crossair' },
    { file: 'bigtime.mod', author: 'ISO/Axis Group' },
    { file: 'cannonfodder.mod', author: 'John Hare' },
    { file: 'desert_strike.mod', author: 'Jason Whitley' },
    { file: 'LotusII.mod', author: 'Barry Leitch' },
    { file: 'projectx.mod', author: 'Allister Brimble' },
    { file: 'silkworm.mod', author: 'Barry Leitch' },
    { file: 'tax_haven_dry_hump.mod', author: 'Barry Leitch' },
    { file: 'h0ffman_-_drop_the_panic.mod', author: 'toto' },
    { file: 'slinger.mod', author: 'toto' },
    { file: 'variations.mod', author: 'toto' }
],
    selectedMod = 0,
    prefix = 'audio/',
    toast;

window.onload = function () {
    var canvas = document.getElementById('visualizer'),
        effect = 1,
        effects = [],
        ctx = canvas.getContext('2d'),
        canvasWidth = canvas.width,
        canvasHeight = canvas.height,
        channelsPlaying = [true, true, true, true];

    toast = new Toast('info-snackbar');

    document.addEventListener('moduleLoaded', (event) => {
        toast.show(`Module loaded: ${moduleList[selectedMod].file}`);

        const samples = event.data.samples;
        let str = '';
        for (let i = 0; i < samples.length; ++i) {
            if (samples[i].name.length) {
                str += `<li>${samples[i].name}</li>`;
            }
        }

        document.querySelector('.sample-list').innerHTML = str;

        document.querySelector('.song-title').innerText = event.data.title;
        document.querySelector('.title').innerText = moduleList[selectedMod].file;
        document.querySelector('.author').innerText = moduleList[selectedMod].author;
        document.querySelector('.song-length').innerText = event.data.length;
        document.querySelector('.song-samples').innerText = event.data.samples.length;
        document.querySelector('.song-positions').innerText = event.data.positions;
        document.querySelector('.song-patterns').innerText = event.data.patterns;

        document.querySelector('#loader').classList.remove('is-active');

        document.querySelectorAll('.controls button').forEach((button) => {
            button.style.display = 'inline-block';
        });

        togglePlayButton();

        if (event.data.wasPlaying) {
            togglePlay();
        }
    });

    var modNav = document.querySelector('.nav-module'),
        options = '';

    moduleList.forEach((module, i) => {
        options += `<a onclick="loadModule(${i});return false;" href="#" class="mdl-navigation__link mod_${i} `;
        if (i === selectedMod) {
            options += ' selected';
        }
        options += `">${module.file}</a>`;
    });

    modNav.innerHTML = options;

    componentHandler.upgradeDom();

    document.addEventListener('keyup', (e) => e.keyCode === 32 && togglePlay());

    document.querySelector('.mdl-card__title-text').addEventListener('click', () => {
        document.querySelector('.mdl-layout__obfuscator').click();
    });

    document.addEventListener('analyzer_ready', (event) => {
        requestAnimationFrame(() => {
            effects[effect](event.data);
        });
    });

    canvas.addEventListener('click', (event) => {
        const width = canvas.width / 4,
            channel = Math.floor(event.offsetX / width);

        channelsPlaying[channel] = !channelsPlaying[channel];

        ModPlayer.setPlayingChannels(channelsPlaying);
    });

    function drawBars(amplitudeArray) {
        var bufferLength = amplitudeArray.length;
        ctx.fillStyle = 'rgb(0, 0, 0)';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        var barWidth = (canvasWidth / bufferLength) * 2.5 - 1;
        barWidth *= 2;
        var barHeight;
        var x = 0;

        for (var i = 0; i < bufferLength; i++) {
            barHeight = amplitudeArray[i];

            ctx.fillStyle = 'rgb(' + (barHeight + 100) + ',50,50)';
            ctx.fillRect(x, canvasHeight - barHeight / 2, barWidth, barHeight / 2);

            x += barWidth;
        }
    }

    function drawOscillo(amplitudeArray) {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        for (var i = 0; i < amplitudeArray.length; i++) {
            var value = amplitudeArray[i] / 256;
            var y = canvasHeight - (canvasHeight * value) - 1;
            ctx.fillStyle = '#000000';
            ctx.fillRect(i, y, 1, 1);
        }
    }

    function drawOscillo2(amplitudeArray) {
        var bufferLength = amplitudeArray.length;

        ctx.fillStyle = "rgb(200, 200, 200)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgb(0, 0, 0)";

        ctx.beginPath();

        var sliceWidth = canvas.width * 1.0 / bufferLength;
        var x = 0;

        for (var i = 0; i < bufferLength; i++) {

            var v = amplitudeArray[i] / 128.0;
            var y = v * canvas.height / 2;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
    }

    effects.push(drawBars, drawOscillo);

    ModPlayer.init({
        canvas: canvas
    }).then(() => {
        loadModule(selectedMod, false);
        }).catch((err) => {
            debugger;
        toast.show(`Error loading module: ${err}`);
    });
}

function togglePlayButton() {
    document.querySelector('button.play i').innerText = ModPlayer.playing && 'pause' || 'play_arrow';
}

function togglePlay() {
    ModPlayer.play();
    togglePlayButton();
}

function stop() {
    ModPlayer.stop();
    togglePlayButton();
}

function loadModule(moduleIndex, hideDrawer = true) {
    var moduleName = moduleList[moduleIndex].file;

    selectedMod = moduleIndex;

    if (ModPlayer.ready && moduleName) {
        // I guess that's the best way to programmatically hide the drawer
        // since MDL does not provide any API to do that
        if (hideDrawer) {
            document.querySelector('.mdl-layout__obfuscator').click();
        }

        document.querySelector('#loader').classList.add('is-active');

        document.querySelectorAll('.controls button').forEach((button) => {
            button.style.display = 'none';
        });

        document.querySelector('a.mdl-navigation__link.selected').classList.toggle('selected');
        document.querySelector(`a.mdl-navigation__link.mod_${moduleIndex}`).classList.add('selected');

        ModPlayer.loadModule(prefix + moduleName)
            .catch(err => {
                toast.show(`Error loading module: ${err}`);
            });
    }
}