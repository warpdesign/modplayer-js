# modplayer-js
JavaScript player for SoundTracker/Noisetracker mod files using the webaudio API.

For a demo, head over [here](http://htmlpreview.github.io/?https://github.com/warpdesign/modplayer-js/blob/master/index.html).

# What's implemented

Amiga 4 channel Sountracker/Noisetracker mod files with 4 channels and 15-31 instruments are supported.

Most effects like `vibrato`, `arpeggio` aren't supported yet but lot's of files use very little effects so work already correctly.

Only these effects are supported:

 - set speed (inc. bpm variant)
 - set volume

# Module background

Modules are like MIDI files but with custom sound samples instead of builtin synth files.

Modules produce sound by playing included samples at a specific rate: this simulates the concept of note. Even though included sounds are encoded at a specific rate, this isn't part of the module file.

Instead of playing at a specific rate, a `period` is used during which the same sample is played. This is directly reminiscent of the Amiga's hardware and more specfically the Paula sound chip.

To reproduce the original sound the mod creator has to play it at the note which would play it at the same rate as it was encoded.

Soundtracker modules have 4 voices which can be independentaly played with a specific period and volume.

In addition to the notion of period, there is a speed at which tracks are played which was again close to the Amiga's hardware because it was synced to the monitor's refresh rate: 50hz for PAL and 60hz for NTSC.

This formula gives the speed

# Module files today

Original Soundtracker mod files only supported 4 channels and 15 instruments. Sample length was limited to 9,999 bytes and sample resolution was only 8bit but it was quickly extended to support 31 instruments and no special limit on sample length.

With the advent of PC sound cards with better sound capabilites (Gravis Ultra Sound could mix as many as 32 channels in hardware in 1993), the mod format was extended with more channels, more effects, 16 bit samples...

New formats were also created: S3M, IT,...

Even though its use is very limited today thanks to virtually unlimited computing power and storage size, it's amazing what can be done with only module files.

That said, it's still in use today, mostly in the demo scene, and in some rare games.

# Module format

The original Sountracker format is quite simple: it starts by listing the mod's title, padded to 20 ASCII characters: there isn't even a magic number.

Then samples information is stored:

Offset | Information | Size (bytes)
--- | --- | ---
0 | Sample name | 22
22 | Sample Length | 2
24 | Finetune | 1
25 | Volume | 1
26 | Repeat Start | 2
28 | Repeat End | 2

Then comes the patterns data: first the list of positions and then each patterns information which is encoded: each note information takes 4 bytes. Since there are 64 rows and 4 channels, this means a pattern takes exactly `64 * 4 * 4 = 1024 bytes`.

Last but not least, sample data is stored, uncompressed in LPCM 8bit format.

More information can be found in the [original specs](https://github.com/cmatsuoka/tracker-history/blob/master/reference/amiga/soundtracker/Soundtracker_v1-v9/Soundtracker_v2.doc) file (which was written in 1988: ouch!).