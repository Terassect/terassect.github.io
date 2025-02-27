import PianoRoll from './pianoRoll.js'
import JSONCrush from './JSONCrush.js';

const defaults = {
    tempo:120
}

class Riffagram_View extends HTMLElement
{
    pianoRoll ;

    constructor (patchConnection)
    {
        super();
        this.patchConnection = patchConnection;
        this.classList = "main-view-element";
        this.innerHTML = this.getHTML();
    }
    first=true; 

    sendPatternToProc;

    connectedCallback()
    {
        document.addEventListener('contextmenu', function(event) { event.preventDefault(); });

        // this.style.width = "100%";
        // this.style.height = "100%";
        this.style.display = "grid";
        this.style.gridTemplateColumns = "1fr 9fr";

        if(!this.pianoRoll ){
            if(customElements.getName(PianoRoll) == null){
                customElements.define('piano-roll',PianoRoll);
            }
            this.pianoRoll = new PianoRoll();
            this.appendChild(this.pianoRoll);
        }

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

        this.patchConnection.addEndpointListener("patternTimeOut",(e) =>{
            this.pianoRoll.setPlayingTime(e);
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

        this.querySelector('#playButton').onclick = (e) => {
            this.patchConnection.sendEventOrValue('start',[]);
        }

        this.querySelector('#stopButton').onclick = (e) => {
            this.patchConnection.sendEventOrValue('stop',[]);
        }

        this.querySelector("#tempoInput").onchange = (e) => {
            console.log("tempo changed");
            this.patchConnection.sendEventOrValue('tempoIn', this.querySelector("#tempoInput").value);
        }

        const postStateToUrl = (pattern) => {
            var extras = {
                tempo: this.querySelector("#tempoInput").value
            }
            console.log("extras: ",extras);

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
                console.log("recovered tempo: " ,pattern.tempo);

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


        while(this.pianoRoll.connectedCallbackFinished == false){}

        this.patchConnection.sendEventOrValue('stop',[]);

        // this.querySelector("tempoInput").onclick = (e) => {
        //     console.log("tempo mouse move: ",e)
        // }
        getStateFromUrl();
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

        <div id="songParms" >
            <input type="button" class="song-parm" id="playButton" value="play"/>
            <input type="button" class="song-parm" id="stopButton" value="stop"/>
            <input type="number" class="song-parm" id="tempoInput" value="120"/>
        </div>

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
