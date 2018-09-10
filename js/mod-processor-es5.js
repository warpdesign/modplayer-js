var t=function(t,e,s){void 0===s&&(s=0);for(var i=new Uint8Array(t),a="",o=!1,n=0;!o;++n){var r=i[s+n];(o=0===r)||(a+=String.fromCharCode(r))}return a},e=function(t,e,s){return void 0===e&&(e=0),void 0===s&&(s=!1),new DataView(t).getUint16(e,s)},s=function(s){function a(){s.call(this),this.port.onmessage=this.handleMessage.bind(this),this.patternOffset=1084,this.patternLength=1024}return s&&(a.__proto__=s),(a.prototype=Object.create(s&&s.prototype)).constructor=a,a.prototype.handleMessage=function(t){var e=this;switch(t.data.message){case"init":this.mixingRate=t.data.mixingRate;break;case"loadModule":this.prepareModule(t.data.buffer);break;case"setPlay":this.ready&&(this.playing=t.data.playing);break;case"reset":this.ready&&this.resetValues();break;case"setPlayingChannels":console.log(t.data.channels),t.data.channels.forEach(function(t,s){var i=e.channels[s];i&&(i.off=!t)})}},a.prototype.postMessage=function(t){this.port.postMessage(t)},a.prototype.process=function(t,e,s){return this.ready&&this.playing?this.mix(e[0]):this.emptyOutputBuffer(e[0]),!0},a.prototype.emptyOutputBuffer=function(t){for(var e=t[0].length,s=t.length,i=0;i<e;++i)for(var a=0;a<s;++a)t[a][i]=0},a.prototype.init=function(){this.name="",this.samples=[],this.patterns=[],this.positions=[],this.songLength=0,this.channels||(this.channels=new Array(4)),this.maxSamples=0,this.bpm=125,this.speed=6,this.position=0,this.pattern=0,this.row=0,this.samplesPerTick=0,this.filledSamples=0,this.ticks=0,this.newTick=!0,this.rowRepeat=0,this.rowJump=-1,this.skipPattern=!1,this.jumpPattern=-1,this.buffer=null,this.started=!1,this.ready=!1,this.playing=!1},a.prototype.resetValues=function(){this.started=!1,this.position=0,this.row=0,this.ticks=0,this.filledSamples=0,this.speed=6,this.newTick=!0,this.rowRepeat=0,this.rowJump=-1,this.skipPattern=!1,this.jumpPattern=-1,this.createChannels(),this.decodeRow()},a.prototype.createChannels=function(){for(var t=0;t<this.channels.length;++t){var e={sample:-1,samplePos:0,period:0,volume:64,slideTo:-1,slideSpeed:0,delay:0,vform:-1,vdepth:0,vspeed:0,id:t};this.channels[t]?Object.assign(this.channels[t],e):this.channels[t]=e}},a.prototype.prepareModule=function(e){console.log("Decoding module data..."),this.ready=!1,this.init(),this.buffer=e,this.name=t(this.buffer,20),this.getInstruments(),this.getPatternData(),this.getSampleData(),this.calcTickSpeed(),this.createChannels(),this.resetValues(),this.ready=!0,this.postMessage({message:"moduleLoaded",data:{samples:this.samples,title:this.name,length:this.buffer.byteLength,positions:this.positions.length,patterns:this.patterns.length}})},a.prototype.detectMaxSamples=function(){var e=t(this.buffer,4,1080);this.maxSamples=e.match("M.K.")?31:15},a.prototype.calcTickSpeed=function(){this.samplesPerTick=60*this.mixingRate/this.bpm/24},a.prototype.mix=function(t){for(var e=t[0].length,s=0;s<e;++s){t[0][s]=0,t[1][s]=0;var i=0;this.tick();for(var a=0;a<this.channels.length;++a){var o=this.channels[a];if(i^=1&a,this.newTick&&o.cmd&&this.executeEffect(o),!o.off&&o.period&&o.sample>-1&&!o.done&&this.ticks>=o.delay){var n=this.samples[o.sample];t[i][s]+=n.data[Math.floor(o.samplePos)]*o.volume/64,o.samplePos+=7093789.2/(2*o.period*this.mixingRate),o.done||(n.repeatLength||n.repeatStart?o.samplePos>=n.repeatStart+n.repeatLength&&(o.samplePos=n.repeatStart):o.samplePos>n.length&&(o.samplePos=0,o.done=!0))}}this.filledSamples++,this.newTick=!1}},a.prototype.tick=function(){this.filledSamples>this.samplesPerTick&&(this.newTick=!0,this.ticks++,this.filledSamples=0,this.ticks>this.speed-1&&(this.ticks=0,this.rowRepeat<=0&&this.row++,(this.row>63||this.skipPattern)&&(this.skipPattern=!1,this.jumpPattern>-1?(this.position=this.jumpPattern,this.jumpPattern=-1,this.getNextPattern()):this.getNextPattern(!0)),this.rowJump>-1&&(this.row=this.rowJump,this.rowJump=-1),this.row>63&&(this.row=0),this.decodeRow(),console.log("** next row !",this.row.toString(16).padStart(2,"0"))))},a.prototype.getNextPattern=function(t){t&&this.position++,this.position>this.positions.length-1&&(console.log("Warning: last position reached, going back to 0"),this.position=0),this.pattern=this.positions[this.position],console.log("** position",this.position,"pattern:",this.pattern)},a.prototype.decodeRow=function(){this.started||(this.started=!0,this.getNextPattern());for(var t=new Uint8Array(this.patterns[this.pattern],16*this.row,16),e=0;e<this.channels.length;++e){var s=4*e,i=(15&t[s])<<8|t[1+s],a=(240&t[s]|t[2+s]>>4)-1,o=15&t[2+s],n=t[3+s],r=this.channels[e];r.delay=0,o?14===o?(r.cmd=224+(n>>4),r.data=15&n):(r.cmd=o,r.data=n):r.cmd=0,a>-1&&(3!==r.cmd&&5!==r.cmd&&(r.samplePos=0),r.done=!1,r.sample=a,r.volume=this.samples[a].volume),i&&(r.done=!1,3!==r.cmd&&5!==r.cmd?(r.period=i,r.samplePos=0):r.slideTo=i)}},a.prototype.executeEffect=function(t){try{i[t.cmd](this,t)}catch(e){console.warn("effect not implemented: "+t.cmd.toString(16).padStart(2,"0")+"/"+t.data.toString(16).padStart(2,"0"))}},a.prototype.getInstruments=function(){this.detectMaxSamples(),this.samples=new Array;for(var s=20,i=new Uint8Array(this.buffer),a=0;a<this.maxSamples;++a){var o={name:t(this.buffer,22,s),length:2*e(this.buffer,s+22),fintune:240&i[s+24],volume:i[s+25],repeatStart:2*e(this.buffer,s+26),repeatLength:2*e(this.buffer,s+28),data:null};2===o.repeatLength&&(o.repeatLength=0),o.repeatLength>o.length&&(o.repeatLength=0,o.repeatStart=0),this.samples.push(o),s+=30}},a.prototype.getPatternData=function(){var t=new Uint8Array(this.buffer,950);this.songLength=t[0];for(var e=2,s=0,i=0;i<this.songLength;++i){var a=t[e+i];this.positions.push(a),a>s&&(s=a)}e=this.patternOffset;for(var o=0;o<=s;++o)this.patterns.push(this.buffer.slice(e,e+this.patternLength)),e+=this.patternLength},a.prototype.getSampleData=function(){for(var t=this.patternOffset+this.patterns.length*this.patternLength,e=0;e<this.samples.length;++e){for(var s=this.samples[e].length,i=new Float32Array(s),a=new Int8Array(this.buffer,t,s),o=0;o<s;++o)i[o]=a[o]/128;this.samples[e].data=i,t+=s}},a.prototype.toggleLowPass=function(t){this.postMessage({message:"toggleLowPass",data:{activate:t}})},a}(AudioWorkletProcessor);registerProcessor("mod-processor",s);var i={1:function(t,e){t.ticks&&(e.period-=e.data,e.period<113&&(e.period=113))},2:function(t,e){t.ticks&&(e.period+=e.data,e.period>856&&(e.period=856))},3:function(t,e,s){t.ticks?e.slideTo&&t.ticks?e.period<e.slideTo?(e.period+=e.slideSpeed,e.period>e.slideTo&&(e.period=e.slideTo)):e.period>e.slideTo&&(e.period-=e.slideSpeed,e.period<e.slideTo&&(e.period=e.slideTo)):console.log("portamento + volume slide: keeping previous values"):!s&&e.data&&(e.slideSpeed=e.data)},4:function(t,e){if(t.ticks)console.warn("vibrato not implemented yet");else{var s=15&e.data,i=(240&e.data)>>4;i&&s&&(e.vdepth=s,e.vspeed=i)}},5:function(t,e){this[3](t,e),this[10](t,e)},6:function(t,e){this[4](t,e),this[10](t,e)},9:function(t,e){t.ticks||(e.samplePos=256*e.data)},10:function(t,e){if(t.ticks){var s=e.data>>4,i=15&e.data;i?s||(e.volume-=i):e.volume+=s,e.volume>63?e.volume=63:e.volume<0&&(e.volume=0)}},11:function(t,e){e.data>=0&&e.data<=t.patterns.length-1&&(t.skipPattern=!0,t.jumpPattern=e.data,t.rowJump=0)},12:function(t,e){t.ticks||(e.volume=e.data,e.volume>63&&(e.volume=63))},13:function(t,e){t.ticks||(t.rowJump=10*((240&e.data)>>4)+(15&e.data),t.skipPattern=!0)},224:function(t,e){t.ticks||(console.log("need to toggle lowPass",!!e.data),t.toggleLowPass(!!e.data))},230:function(t,e){0===e.data?e.loopCount&&(e.loopStart=t.row,e.loopCount--,e.loopCount||(e.loopDone=!0)):e.loopDone||(e.loopCount||(e.loopCount=e.data),e.rowJump=e.loopStart)},233:function(t,e){(t.ticks+1)%e.data||(console.log("retriggering note!",t.ticks+1),e.samplePos=0,e.done=!1)},234:function(t,e){t.ticks||(e.volume+=e.data,e.volume>63&&(e.volume=63))},237:function(t,e){t.ticks||(e.delay=e.data)},238:function(t,e){t.ticks||(t.rowRepeat?t.rowRepeat&&t.rowRepeat--:(t.rowRepeat=e.data,console.log("setting repeat to",t.rowRepeat)))},15:function(t,e){t.ticks||(e.data<32?t.speed=e.data:(t.bpm=e.data,t.calcTickSpeed()))}};
//# sourceMappingURL=modplayer-js.js.map