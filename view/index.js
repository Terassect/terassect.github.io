import PianoRoll from './pianoRoll.js'
import JSONCrush from './JSONCrush.js';

const defaults = {
    tempo:120
}

class Riffagram_View extends HTMLElement
{
    pianoRoll ;
    parms;

    constructor (patchConnection)
    {
        super();
        this.patchConnection = patchConnection;
        this.classList = "main-view-element";
    }

    sendPatternToProc;

    resize(){
        const r = this.getBoundingClientRect();
        const parmsW = window.innerHeight*0.05;//r.height*0.05;
        const butts = document.getElementsByTagName('button');

        if(r.width > r.height){
            this.parms.style.width = numToStrPx(parmsW);
            this.parms.style.height = "100%";
            this.pianoRoll.style.width = numToStrPx(r.width - parmsW);
            
        } else {
            this.parms.style.height = numToStrPx(parmsW);
            this.parms.style.width =  numToStrPx(r.width);

            const tempo = document.getElementById("tempoInput");
            tempo.style.fontSize = numToStrPx(parmsW);
            tempo.style.top = "0px";
            tempo.style.height = numToStrPx(parmsW)

            this.pianoRoll.style.width = numToStrPx(r.width);
            this.pianoRoll.style.height = numToStrPx(r.height - parmsW);
            this.pianoRoll.style.top = numToStrPx(parmsW);
            this.pianoRoll.style.left = "0px";

        }


        for( const e of document.getElementsByTagName('button') ){
            console.log(e);
            e.style.width = numToStrPx(parmsW);
            e.style.height = numToStrPx(parmsW);
        }

        console.log("outer rsize");
        this.pianoRoll.resize();
    }

    connectedCallback()
    {
        document.addEventListener('contextmenu', function(event) { event.preventDefault(); });

        // this.style.display = "grid";
        // this.style.gridTemplateColumns = "1fr 9fr";

        customElements.define('piano-roll',PianoRoll);

        this.innerHTML = this.getHTML();

        this.pianoRoll = this.querySelector("#pianoRoll");
        this.parms = this.querySelector("#patternPlayerParms");


        this.pianoRoll.procChangePatternMetadata = (pattern) => {
            const pat = {
                start: pattern.se[0],
                end: pattern.se[1],
                loopStart: pattern.lr[0],
                loopEnd: pattern.lr[1],
                beatsPerBar: pattern.bpb,
                stepsPerBeat: pattern.spb,
                active: true
            }
            this.patchConnection.sendEventOrValue("patternIn",pat,0);
        }

        this.pianoRoll.procChangePatternMetadata(this.pianoRoll.pattern);
        
        const playButton = this.querySelector('#playButton');
        playButton.style.transition = "background-color 0.25s ease";
        playButton.fadeTimeout ;
        this.patchConnection.addEndpointListener("patternTimeOut",(e) => {
            this.pianoRoll.setPlayingTime(e);
            if(playButton.style.backgroundColor != "lime"){
                playButton.style.backgroundColor = "lime";
            }
            clearTimeout(playButton.fadeTimeout)
            playButton.fadeTimeout = setTimeout(() => {playButton.style.backgroundColor = "honeydew";},100)
            
        });

        const guiNoteToProcNote= (n) => {
            return {
                active: true,
                start: n[0],
                end: n[1],
                noteNum: n[2],
                velocity: n[3]
            };
        }

        this.pianoRoll.procChangeNote = (n1,n2) =>{
            this.patchConnection.sendEventOrValue("noteIn", [guiNoteToProcNote(n1),guiNoteToProcNote(n2)] ,0);
        }

        this.pianoRoll.procAddNewNote = (note) => {
            this.patchConnection.sendEventOrValue("noteIn", [guiNoteToProcNote([0,0,128,0]),guiNoteToProcNote(note)] ,0);
        }

        this.pianoRoll.procRemoveNote = (n) => {
            this.patchConnection.sendEventOrValue("noteIn", [guiNoteToProcNote([-1,-1,129,-1]),guiNoteToProcNote(n)] ,0);
        }

        this.pianoRoll.pattern.ns.forEach( n => {
            this.pianoRoll.procAddNewNote(n);
        })

        this.patchConnection.sendEventOrValue('start',);


        playButton.onclick = (e) => {
            this.patchConnection.sendEventOrValue('start',[]);
        }

        this.querySelector('#stopButton').onclick = (e) => {
            this.patchConnection.sendEventOrValue('stop',[]);
        }

        this.querySelector("#tempoInput").onchange = (e) => {
        }

        const postStateToUrl = (pattern) => {
            var extras = {
                tempo: this.querySelector("#tempoInput").value
            }

            const un = JSON.stringify({...pattern,...extras})
            console.log("json len: ", un.length);
            var url = JSONCrush.crush(un)
            url = encodeURIComponent(url);
            console.log("crushed len: ", url.length);

            sessionStorage.setItem("path",url);
            url = window.location.origin + "/" +url;

            window.history.pushState("state","",url);
        }

        const getStateFromUrl = () => {
            var s = sessionStorage.getItem("path");
            s=decodeURIComponent(s);
            try{
                const pattern = JSON.parse( JSONCrush.uncrush(s) );
                this.pianoRoll.setPattern(pattern);

                this.pianoRoll.draw();

                this.querySelector("#tempoInput").value = pattern.tempo ? pattern.tempo: defaults.tempo ;
                this.querySelector("#tempoInput").onchange();
            } catch (error) {
            }
        }

        var timeout;
        var urlIsDirty;
        this.stateChanged = () => {

        }
        this.pianoRoll.patternChanged = function (){
            if(!timeout){
                postStateToUrl(this.pattern);
                timeout = setTimeout(()=>{
                    if(urlIsDirty){
                        postStateToUrl(this.pattern);
                    }
                    timeout=null;
                },1000)
            } else {
                urlIsDirty=true;
            }
        }

        const tempo = document.getElementById("tempoInput");
        tempo.val = 120;
        tempo.dsx = 0;
        tempo.dsy = 0;
        tempo.dsVal = tempo.val;
        tempo.isDragging = false;

        const blank= document.createElement('span');
    
        tempo.ondragstart = (e) =>{
            tempo.dsx = e.screenX;
            tempo.dsy = e.screenY;
            tempo.dsVal = tempo.val;
            e.dataTransfer?.setDragImage(blank,0,0)
            tempo.isDragging = true;
        }
    
        tempo.ondrag = (e) => {
            if(e.screenX ==0 ){return;}
            const dx = e.screenX - tempo.dsx;
            const dy = e.screenY -tempo.dsy;
            tempo.val = tempo.dsVal * Math.exp( (dx-dy)/2000 );
            tempo.val = Math.floor(tempo.val);
            tempo.innerHTML = tempo.val.toString();
            this.patchConnection.sendEventOrValue('tempoIn',tempo.val);
        };
    
        tempo.addEventListener("touchstart",(e)=>{
            console.log(e);
            tempo.ondragstart(e.touches[0]);
        })
        this.addEventListener("touchend",(e)=>{tempo.isDragging = false;})
        this.addEventListener("touchmove",(e)=>{
            if(tempo.isDragging){tempo.ondrag(e.touches[0]);}
            
        })


        while(this.pianoRoll.connectedCallbackFinished == false){}

        this.patchConnection.sendEventOrValue('stop',[]);

        getStateFromUrl();

        window.addEventListener('resize', (event) => {
            this.resize();
         }, true);

        setTimeout(()=>{
            this.resize();
            // this.draw();
        },100);
    }

    disconnectedCallback()
    {
        // When our element is removed, this is a good place to remove
        // any listeners that you may have added to the PatchConnection object.
        // this.patchConnection.removeParameterListener ("frequency", this.freqListener);
    }

    getHTML()
    {
        return `
        <link rel="stylesheet" href="./styles.css">

        <div id="patternPlayerParms" >
            <button type="button" class="song-parm" id="playButton">
                <svg viewBox="0 0 10 10">
                    <polygon points="1,1 9,5 1,9" style="fill:none;stroke:black;stroke-width:1" 
                    stroke-linejoin="round"
                    stroke-width="30" />
                </svg>
            </button>
            <button type="button" class="song-parm" id="stopButton" >
                <svg viewBox="0 0 10 10">
                    <polygon points="1,1 9,1 9,9 1,9" style="fill:none;stroke:black;stroke-width:1"         
                    stroke-linejoin="round"
                    stroke-width="30" />
                </svg>
            </button>
            <span id="tempoInput" draggable="true" >120</span>
        </div>
        <piano-roll id="pianoRoll" />
        `;
    }
}

window.customElements.define ("riffagram-view", Riffagram_View);

/* This is the function that a host (the command line patch player, or a Cmajor plugin
   loader, or our VScode extension, etc) will call in order to create a view for your patch.

   Ultimately, a DOM element must be returned to the caller for it to append to its document.
   However, this function can be `async` if you need to perform asyncronous tasks, such as
   fetching remote resources for use in the view, before completing.
*/
export default function createPatchView (patchConnection)
{
    return new Riffagram_View (patchConnection);
}
