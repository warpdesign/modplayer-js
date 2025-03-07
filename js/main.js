var moduleList = [
    { file: 'https://api.modarchive.org/downloads.php?moduleid=91286#faggots_universe.mod', author: 'Deelite' },
    { file: 'https://api.modarchive.org/downloads.php?moduleid=182057#h0ffman_-_drop_the_panic.mod', author: 'h0ffman' },
    { file: 'https://api.modarchive.org/downloads.php?moduleid=168122#prodigy_-_downtown.mod', author: 'prodigy of oops' },
    { file: 'https://api.modarchive.org/downloads.php?moduleid=172266#hoffman_-_the_hunter.mod', author: 'h0ffman' },
    { file: 'https://api.modarchive.org/downloads.php?moduleid=65280#variations.mod', author: 'jogeir-liljedahl' },
    // { file: 'https://api.modarchive.org/downloads.php?moduleid=166686#wiklund_-_bonfire.mod', author: 'Wiklund' },
    { file: 'https://api.modarchive.org/downloads.php?moduleid=55058#pinball_illusions.mod', author: 'Olof Gustafsson' },
    { file: 'https://api.modarchive.org/downloads.php?moduleid=167668#vinnie_-_sweet_dreams.mod', author: 'vinnie/spaceballs' },
    { file: 'https://api.modarchive.org/downloads.php?moduleid=172271#subi-king_of_boggle.mod', author: 'Subi/DESiRE' },
    // { file: 'https://api.modarchive.org/downloads.php?moduleid=171416#bass-1107.mod', author: 'Noiseless (cm/ao)' },
    { file: 'https://api.modarchive.org/downloads.php?moduleid=168110#punnik_-_drum_bass.mod', author: 'punnik' },
    // { file: 'https://api.modarchive.org/downloads.php?moduleid=171616#dan_-_childs_philozophy.mod', author: 'dan / picco' },
    { file: 'https://api.modarchive.org/downloads.php?moduleid=119303#boesendorfer_p_s_s.mod', author: 'romeoknight' },
    // { file: 'https://api.modarchive.org/downloads.php?moduleid=170637#ghost_in_the_cli.mod', author: 'h0ffman' },
    // { file: 'https://api.modarchive.org/downloads.php?moduleid=158057#alf_-_no-mercy.mod', author: 'alf/vtl' },
    { file: 'https://api.modarchive.org/downloads.php?moduleid=105709#trans_atlantic.mod', author: 'Lizardking'},
    { file: 'https://api.modarchive.org/downloads.php?moduleid=124303#agony_intro.mod', author: 'Tim Wright' },
    { file: 'https://api.modarchive.org/downloads.php?moduleid=168739#neurodancer_-_quasar.mod', author: 'Neurodancer' },
    { file: 'https://api.modarchive.org/downloads.php?moduleid=183672#tax_haven_dry_hump.mod', author: 'Curt Cool' },
    { file: 'https://api.modarchive.org/downloads.php?moduleid=98051#big_time_sensuality.mod', author: 'ISO/Axis Group' },
    { file: 'https://api.modarchive.org/downloads.php?moduleid=34568#CANNONFO.MOD', author: 'John Hare' },
    { file: 'https://api.modarchive.org/downloads.php?moduleid=68835#desert_strike.mod', author: 'Jason Whitley' },
    { file: 'https://api.modarchive.org/downloads.php?moduleid=87180#lotus2-title.mod', author: 'Barry Leitch' },
    { file: 'https://api.modarchive.org/downloads.php?moduleid=56660#projectx.mod', author: 'Allister Brimble' },
    { file: 'https://api.modarchive.org/downloads.php?moduleid=83115#silkwormtitle.mod', author: 'Barry Leitch' }
],
    selectedMod = 0,
    prefix = 'audio/',
    toast;

window.onload = function () {
    var canvas = document.getElementById('visualizer'),
        channelsPlaying = [true, true, true, true],
        audioWorkletSupport = !!AudioWorkletNode.toString().match(/native code/);

    toast = new Toast('info-snackbar');

    document.addEventListener('moduleLoadError', () => {
        toast.show(`Error loading module: are you sure this is a Sound Tracker module file?`);
        removeLoader()
    })

    document.addEventListener('moduleLoaded', (event) => {
        const name = event.data.title || "No Title"

        toast.show(`Module loaded: ${event.data.title || "No Name"}`);

        const samples = event.data.samples;
        let str = '';
        for (let i = 0; i < samples.length; ++i) {
            if (samples[i].name.length) {
                str += `<li>${samples[i].name}</li>`;
            }
        }

        document.querySelector('.sample-list').innerHTML = str;

        document.querySelector('.song-title').innerText = event.data.title;
        document.querySelector('.title').innerText = name;
        document.querySelector('.author').innerText = moduleList[selectedMod]?.author || 'Unknown Author';
        document.querySelector('.song-length').innerText = event.data.length;
        document.querySelector('.song-samples').innerText = event.data.samples.length;
        document.querySelector('.song-positions').innerText = event.data.positions;
        document.querySelector('.song-patterns').innerText = event.data.patterns;

        document.querySelector('a.mdl-navigation__link.selected')?.classList.remove('selected');
        typeof selectedMod === 'number' && document.querySelector(`a.mdl-navigation__link.mod_${selectedMod}`).classList.add('selected');

        removeLoader();

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
        const split = module.file.split('#'),
            name = split.length > 1 && split[1] || split[0];
        options += `">${name}</a>`;
    });

    modNav.innerHTML = options;

    componentHandler.upgradeDom();

    document.addEventListener('keyup', (e) => e.keyCode === 32 && togglePlay());

    document.querySelector('.mdl-card__title-text').addEventListener('click', () => {
        document.querySelector('.mdl-layout__obfuscator').click();
    });

    canvas.addEventListener('click', (event) => {
        const width = canvas.clientWidth / 4,
            channel = Math.floor(event.offsetX / width);

        // audioworklet mode shows the four channels
        // scriptprocessor fallback groups 0-3 and 1-2 channels visually
        if (audioWorkletSupport) {
            channelsPlaying[channel] = !channelsPlaying[channel];
        } else {
            if (!channel) {
                channelsPlaying[0] = !channelsPlaying[0];
                channelsPlaying[3] = !channelsPlaying[3];
            } else if (channel === 3) {
                channelsPlaying[1] = !channelsPlaying[1];
                channelsPlaying[2] = !channelsPlaying[2];
            }
        }

        ModPlayer.setPlayingChannels(channelsPlaying);
    });

    ModPlayer.init({
        canvas: canvas,
        audioWorkletSupport: audioWorkletSupport
    }).then(() => {
        loadModule(selectedMod, false);
    }).catch((err) => {
        toast.show(`Error loading module: ${err}`);
    });
}

function removeLoader() {
    document.querySelector('#loader').classList.remove('is-active');

    document.querySelectorAll('.controls button').forEach((button) => {
        button.style.display = 'inline-block';
    });
}

function togglePlayButton() {
    document.querySelector('button.play i').innerText = ModPlayer.playing && 'pause' || 'play_arrow';
    document.querySelector('button.play span').innerText = ModPlayer.playing && 'Pause' || 'Play';
}

function togglePlay() {
    ModPlayer.play();
    togglePlayButton();
}

function stop() {
    ModPlayer.stop();
    togglePlayButton();
}

function loadLocalFile(file) {
    console.log("should load local file", file);
    loadModule(file, false)
}

function loadModule(module, hideDrawer = true) {
    var moduleName = typeof module === 'number' && moduleList[module].file;

    selectedMod = module;

    if (ModPlayer.ready && (moduleName || module)) {
        // I guess that's the best way to programmatically hide the drawer
        // since MDL does not provide any API to do that
        if (hideDrawer) {
            document.querySelector('.mdl-layout__obfuscator').click();
        }

        document.querySelector('#loader').classList.add('is-active');

        document.querySelectorAll('.controls button').forEach((button) => {
            button.style.display = 'none';
        });

        const file = moduleName ?
            (moduleName.match(/^http/) ? moduleName : prefix + moduleName)
            :
            module;

        ModPlayer.loadModule(file)
            .catch(err => {
                toast.show(`Error loading module: ${err}`);
            });
    }
}