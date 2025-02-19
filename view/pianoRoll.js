import PointerHandler from "./PointerHandler.js"

function log(e) {
    console.log(e);
}

class PianoRoll extends HTMLElement {

    socket;
    log(e) {
        if (this.socket) {
            this.socket.send(e)
        }
        console.log(e)
    }

    colors = {
        note: 'rgb(200,20,200)',
        noteH: 'rgb(255,0,255)',
        gridLine: 'rgb(150,150,150)'
    }

    pr;
    pro;


    selectedNoteIdxs = [];
    quantBeats = 1;
    draggedThing = '';

    prCtx;
    proCtx;

    visibleNoteRange = [48, 72];
    visibleTimeRange = [-1., 9.5];

    selectionStart = null;
    selectionCorners = null;

    playingTime = 1.34;

    connectedCallbackFinished = false;

    pattern = {
        se: [0, 8],  //start, end
        lr: [0, 8],  //loop range
        spb: 4,    //steps per beat
        bpb: 4,    //beats per bar
        //notes:  startTime, endTime, noteNum, Vel
        ns: [
            [0.0, 0.5, 60, 100],
            [1.0, 1.5, 64, 100],
            [4., 5.0, 67, 100]
        ]

    }

    noteCopyBuffer = [];

    pointerHandler;

    defaultOperation = "pencil";
    currentOperation = "";

    selectedNoteDeltas;

    numSortFn = (a, b) => { return a - b; }

    constructor() {
        // Always call super first in constructor
        super();
    }

    connectedCallback() {
        // this.socket = new WebSocket("wss://192.168.1.4:8765");
        console.log("Yes" + Date.now())
        this.onscroll = (e) => {
            this.log(e)
        }

        this.style.width = "100%";
        this.style.height = "100%";
        this.style.padding = "0px";
        this.style.margin = "0px";
        this.style.display = "grid";
        this.style.gridTemplateColumns = "1fr 9fr";
        this.style.touchAction = "none";

        // customElements.define('pointer-handler',PointerHandler);

        this.innerHTML = `
        <style>
        #moveButton {
            color: blue;
            background: blue;
            accent-color: red;
            background-color: yellow;
        }
        </style>
        <div id="buttons">
            <input id="deleteButton" type="button" value="del" />
            <input id="moveButton" type="checkbox" value="Move" />

        </div>
        <div id="canvases">
            <meta id="Deleting this will break things" />
            <canvas id="pianoRollCa"></canvas>
            <canvas id="pianoRollOverlay"></canvas>
        </div>
    `;

        var moveButton = this.querySelector("#moveButton");

        for (const button of this.querySelector('#buttons').children) {
            button.style.width = "100%";
            button.style.height = "25%";
            button.style.visibility = "hidden";
        }

        var deleteButton = this.querySelector("#deleteButton");
        deleteButton.onclick = (e) => {
            turnOffToggles();
            hideButtons();
            this.removeNotes(this.selectedNoteIdxs)
            this.selectedNoteIdxs = [];
            this.currentOperation = "pencil";
            this.draw();
        }

        // moveButton.onclick

        const hideButtons =() => {
            for (const button of this.querySelector('#buttons').children) {
                button.style.visibility = "hidden";
            }
        }

        const turnOffToggles = () =>{
            moveButton.checked=false;
        }

        var canvases = this.querySelector('#canvases')
        canvases.style.width = "100%";
        canvases.style.height = "100%";

        this.pr = this.querySelector('#pianoRollCa');
        this.pro = this.querySelector('#pianoRollOverlay');

        this.prCtx = this.pr.getContext("2d");
        this.proCtx = this.pro.getContext("2d");

        if (!this.pointerHandler) {
            customElements.define('pointer-handler', PointerHandler);
            this.pointerHandler = new PointerHandler();
            canvases.appendChild(this.pointerHandler);
        }

        [this.pr, this.pro, this.pointerHandler].forEach(e => {
            e.style.position = 'absolute'
            e.style.border = "1px solid #000000";

            e.style.top = canvases.style.top;
            e.style.left = canvases.style.left;
            e.style.width = canvases.clientWidth.toString() * 0.99 + 'px';
            e.style.height = canvases.clientHeight.toString() * 0.99 + 'px';
            e.style.margin = '0px';
            e.style.padding = '0px';


            e.width = parseInt(e.style.width);
            e.height = parseInt(e.style.height);
        });

        const pinchZoomPan = (z, zPrev, q, screenToLocalFn, screenMax) => {
            const l0 = screenToLocalFn(zPrev[0][q]);
            const l1 = screenToLocalFn(zPrev[1][q]);
            const den = z[1][q] - z[0][q];

            const thresh = 150;
            var r = [0, 1];
            if (Math.abs(den) < thresh) {
                const c = screenToLocalFn(0.5 * (z[1][q] + z[0][q]));
                const dc = c - 0.5 * (l0 + l1);

                r[0] = screenToLocalFn(0) - dc;
                r[1] = screenToLocalFn(screenMax) - dc;

            } else {
                const W = this.pro.width;
                r[0] = -(l1 * z[0][q] - l0 * z[1][q]) / den;
                r[1] = -(screenMax * (l0 - l1)) / den + r[0];
            }
            return r
        }

        this.pointerHandler.doubleDrag = (z, zPrev) => {

            this.visibleTimeRange = pinchZoomPan(z, zPrev, 'x', this.xToTime.bind(this), this.pro.width)
            this.visibleNoteRange = pinchZoomPan(z, zPrev, 'y', this.yToNote.bind(this), this.pro.height)

            this.visibleNoteRange = this.sanitizeRange(this.visibleNoteRange);
            console.log(this.visibleNoteRange);
            this.draw();
        }


        this.pointerHandler.singleDown = (z) => {
            this.currentOperation = this.defaultOperation;

            //Scan buttons for something that would change this.currentOperation
            if(this.querySelector("#moveButton").checked){this.currentOperation="move"}

        }

        this.pointerHandler.singleDrag = (z,zPrev, z0) => {
            if (this.currentOperation == "pencil") { this.currentOperation = "select"; }
            
            
            switch (this.currentOperation) {
                case "select":
                    this.selectionCorners = [z0, z].map( e =>{
                        return {
                            x: e.x, y: e.y,
                            t: this.xToTime(e.x), n: this.yToNote(e.y)
                        }
                    });
                    this.drawOverlay();

                break;
                case "move":
                    if(!this.selectedNoteDeltas){
                        const [t0,n0] = [this.xToTime(z0.x),this.yToNote(z0.y)]

                        this.selectedNoteDeltas = this.selectedNoteIdxs.map( i=> {
                            return { 
                                t: this.pattern.ns[i][0] - t0,
                                n: this.pattern.ns[i][2] - n0 
                            }
                        })
                    }

                    const [t,n] = [ this.xToTime(z.x), this.yToNote(z.y) ]

                    this.selectedNoteIdxs.forEach((i,c) =>{
                        const newTime = this.quantizeTime( t + this.selectedNoteDeltas[c].t );
                        const newNote = Math.floor(n + this.selectedNoteDeltas[c].n);
                        this.moveNote(i,newTime, newNote)
                    })
                break;

            }
        }

        this.pointerHandler.singleUp = (z, z0) => {

            switch (this.currentOperation) {
                case "pencil": this.pencilClick(z); break;
                case "select":
                    const tr = this.sanitizeRange(this.selectionCorners.map(e=>e.t))
                    const nr = this.sanitizeRange(this.selectionCorners.map(e=>e.n))
                    this.selectedNoteIdxs = this.noteIdxsInRanges(tr, nr);
                    break;
            }

            this.querySelector("#deleteButton").style.visibility = this.selectedNoteIdxs.length >= 1 ? "visible" : "hidden";
            this.querySelector("#moveButton").style.visibility = this.selectedNoteIdxs.length >= 1 ? "visible" : "hidden";

            this.selectionCorners = null;
            this.selectedNoteDeltas = null;
            this.draw();
        }


        this.pro.onmousemove = (e) => {
            this.drawOverlay();

            const [x, y] = this.mouseEventToCanvasCoords(e);
            this.loopDragHandlePaths().forEach(path => {
                if (this.proCtx.isPointInPath(path, x, y)) {
                    this.proCtx.fillStyle = 'rgb(0,0,255)'
                    this.proCtx.fill(path);
                }
            })

            this.visibleNotePaths().forEach(path => {
                if (this.proCtx.isPointInPath(path, x, y)) {
                    this.proCtx.fillStyle = this.colors.noteH
                    this.proCtx.fill(path);
                }
            })
        }

        this.draw();
        this.connectedCallbackFinished = true;

    }

    setPattern(pattern) {
        this.procChangePatternMetadata(pattern);
        this.pattern.ns.forEach(note => {
            this.procRemoveNote(note);
        });

        pattern.ns.forEach(note => {
            this.procAddNewNote(note);
        })

        this.pattern = pattern;

    }

    disconnectedCallback() {
        console.log("Custom element removed from page.");
    }

    adoptedCallback() {
        console.log("Custom element moved to new page.");
    }

    attributeChangedCallback(name, oldValue, newValue) {
        console.log(`Attribute ${name} has changed.`);
    }



    /////////////////////////////////////////////////////////////////////
    /////outgoing funs
    procChangePatternMetadata(pattern) { }
    procRemoveNote(note) { }
    procAddNewNote(note) { }
    procChangeNote(note1, note2) { }

    /////////////////////////////////////////////////////////////////
    //////////////incoming funs

    setPlayingTime(t) {
        this.playingTime = t;
        this.drawOverlay();
    }

    // setPattern(pattern){
    //     this.pattern = pattern;
    //     this.draw();
    // }


    /////////////////////////////////////////////////////////////////
    patternChanged() { }

    removeNotes(idxs) {
        idxs.forEach(i => {
            this.procRemoveNote(this.pattern.ns[i]);
        })

        this.pattern.ns = this.pattern.ns.filter((note, i) => {
            return !idxs.includes(i);
        })
        this.patternChanged();
    }

    addNote(note) {
        this.pattern.ns.push(note);
        this.procAddNewNote(note);
        this.draw();
        this.patternChanged();
    }

    moveNote(i, t, n) {
        console.log(i);
        const oldNote = this.pattern.ns[i].slice();
        this.pattern.ns[i][1] = t + (this.pattern.ns[i][1] - this.pattern.ns[i][0])
        this.pattern.ns[i][0] = t;
        this.pattern.ns[i][2] = n;

        this.procChangeNote(oldNote, this.pattern.ns[i]);
        this.draw();
        this.patternChanged();
    }

    setLoop(loop) {
        loop = this.sanitizeRange(loop)
        this.pattern.lr = loop;
        this.draw();

        this.procChangePatternMetadata(this.pattern);
        this.patternChanged();
    }

    setStartend(startend) {
        startend = this.sanitizeRange(startend);
        this.pattern.se = startend;
        this.draw();
        this.procChangePatternMetadata(this.pattern);
        this.patternChanged();
    }

    sanitizeRange(q) {
        if (q[0] == q[1])
            q[1] += 0.001;
        q = q.sort((a, b) => a - b);
        return q;
    }
    floor(x, a) { return Math.floor(x / a) * a; }
    asPercentageOf(x, range) { return (x - range[0]) / (range[1] - range[0]); }

    xToTime(x) {
        const r = this.visibleTimeRange;
        return x / this.pr.width * (r[1] - r[0]) + r[0];
    }

    yToNote(y) {
        const r = this.visibleNoteRange;
        return y / this.pr.height * (r[0] - r[1]) + r[1];
    }

    timeToX(t) { return this.pr.width * this.asPercentageOf(t, this.visibleTimeRange) }

    noteToY(n) { return this.pr.height * (1 - this.asPercentageOf(n, this.visibleNoteRange)) }

    rangeIsOutsideOfRange(r1, r2) {
        return (r1[0] < r2[0] && (r1[1] < r2[0])) || (r1[0] > r2[1] && (r1[1] > r2[1]));
    }

    noteIdxsInRanges(tr, nr) {
        return this.pattern.ns.map((note, i) => {
            if (
                this.rangeIsOutsideOfRange([note[0], note[1]], tr) ||
                this.rangeIsOutsideOfRange([note[2], note[2] + 1], nr)
            ) {
                return null;
            }

            return i;

        }).filter(i => i != null)
    }

    visibleNoteIdxs() { return this.noteIdxsInRanges(this.visibleTimeRange, this.visibleNoteRange); }

    pathOfNote(note) {
        const y = this.noteToY(note[2]);
        const yp1 = this.noteToY(note[2] + 1);
        const x = Math.max(this.timeToX(note[0]), 0);
        const xp1 = Math.min(this.timeToX(note[1]), this.pr.width);
        const path = new Path2D();
        path.rect(
            x, y,
            xp1 - x, yp1 - y
        )
        return path;
    }

    visibleNotePaths() {
        return this.visibleNoteIdxs().map(i => {
            return this.pathOfNote(this.pattern.ns[i]);
        })
    }

    loopDragHandlePaths() {
        const dragBoxWidth = 15;
        const dragBoxHeight = dragBoxWidth * 1.6;

        const path1 = new Path2D();
        path1.rect(this.timeToX(this.pattern.lr[0]) - dragBoxWidth / 2., 0, dragBoxWidth, dragBoxHeight);
        const path2 = new Path2D();
        path2.rect(this.timeToX(this.pattern.lr[1]) - dragBoxWidth / 2., 0, dragBoxWidth, dragBoxHeight);

        return [path1, path2];
    }

    startendDragHandlePaths() {
        const dragBoxWidth = 15;
        const dragBoxHeight = dragBoxWidth * 1.6;

        const path1 = new Path2D();
        path1.rect(this.timeToX(this.pattern.se[0]) - dragBoxWidth / 2., this.pr.height - dragBoxHeight, dragBoxWidth, dragBoxHeight);
        const path2 = new Path2D();
        path2.rect(this.timeToX(this.pattern.se[1]) - dragBoxWidth / 2., this.pr.height - dragBoxHeight, dragBoxWidth, dragBoxHeight);

        return [path1, path2];
    }

    drawLinesAtQuantLevel(q, lineW = 1, shouldPrintT = false) {
        const startT = Math.floor((this.visibleTimeRange[0]) / q) * q;//+ (this.visibleTimeRange[0]<0 ? 1:0);
        // console.log("drawing lines at ", q, startT)

        for (var t = startT; t < this.visibleTimeRange[1]; t += q) {
            this.prCtx.strokeStyle = this.colors.gridLine;

            const x = this.timeToX(t);

            if (shouldPrintT) {
                this.prCtx.font = "20px monospace";
                var bar = (Math.floor(t / this.pattern.bpb));
                var beat = (t - bar * this.pattern.bpb);
                var timeStr = (bar + 1).toString();
                if (q <= this.pattern.bpb * 0.5) {
                    timeStr += ":" + (beat + 1).toString()
                }

                this.prCtx.strokeText(timeStr, x + 0.5, 20);
                // this.prCtx.stroke();
            }

            this.prCtx.lineWidth = lineW;
            this.prCtx.beginPath();
            this.prCtx.moveTo(x, 0);
            this.prCtx.lineTo(x, this.pr.height);
            this.prCtx.stroke();
        }
    }

    draw() {
        this.prCtx.clearRect(0, 0, this.pr.width, this.pr.height);

        this.prCtx.strokeStyle = 'rgb(150,150,150)'
        this.prCtx.lineWidth = 0.5;

        const blackNotes = [1, 3, 6, 8, 10];

        for (var i = Math.max(Math.floor(this.visibleNoteRange[0]), 0);
            i < (this.visibleNoteRange[1]) && i < 128;
            i++
        ) {
            const y = this.noteToY(i);
            const yp1 = this.noteToY(i + 1);

            this.prCtx.fillStyle = 'rgb(200,200,200)'
            if (blackNotes.includes(i % 12)) { this.prCtx.fillRect(0, y, this.pr.width, yp1 - y); }

            //display octave number every C
            if (i % 12 == 0) { this.prCtx.strokeText((Math.floor(i / 12) - 1).toString(), 0, y) }

            this.prCtx.beginPath();
            this.prCtx.moveTo(0, y);
            this.prCtx.lineTo(this.pr.width, y);
            this.prCtx.stroke();
        }

        const minGridlineDistance = this.pr.width / 24;

        const minDt = Math.max(this.xToTime(minGridlineDistance) - this.xToTime(0), 0.001);

        // console.log("minDt", minDt)
        var q = 1;

        if (minDt <= 0.5 / this.pattern.spb) {
            var x = 0.5;
            this.drawLinesAtQuantLevel(x);
            const y = minDt * this.pattern.spb;
            while (y <= x) {
                x *= 0.5;
                this.drawLinesAtQuantLevel(x);
            }
            x *= 2;
            q = x / this.pattern.spb;
        } else if (minDt <= 1 / this.pattern.spb) {
            //TODO: deal with if SPB is even/a power of 2
            q = 1 / this.pattern.spb;
            this.drawLinesAtQuantLevel(q);

        } else if (minDt <= 1) {
            q = 1;
            this.drawLinesAtQuantLevel(q);
            if ((Math.log2(this.pattern.spb) % 2.0) == 0) {
                while (q > 2 / this.pattern.spb && q >= 2 * minDt) {
                    q *= 0.5;
                    this.drawLinesAtQuantLevel(q);
                }
            }
        } else {
            while (q < minDt) {
                q *= 2

            }
            this.drawLinesAtQuantLevel(q);
        }
        // console.log("q",q,minDt);
        this.quantBeats = q;

        var lineWi = 1;
        var n = 3;
        for (var i = 0; i < n; i++) {
            q *= 2;
            lineWi *= 1.5;
            this.drawLinesAtQuantLevel(q, lineWi, true);
        }

        this.prCtx.fillStyle = this.colors.note;

        this.visibleNotePaths().forEach(path => { this.prCtx.fill(path) })

        const dragBoxWidth = 15;
        const dragBoxHeight = dragBoxWidth * 1.6;

        //red-gray outside playing region
        this.prCtx.fillStyle = 'rgba(100,80,80,0.3)';
        var [x0, x1] = [this.timeToX(this.pattern.se[0]), this.timeToX(this.pattern.se[1])];

        this.prCtx.fillRect(0, 0, x0, this.pr.height);
        this.prCtx.fillRect(x1, 0, this.pr.width - x1, this.pr.height);
        this.startendDragHandlePaths().forEach(path => { this.prCtx.fill(path); });

        //light blue loop region
        this.prCtx.fillStyle = 'rgba(200,200,255,0.3)';
        var [x0, x1] = [this.timeToX(this.pattern.lr[0]), this.timeToX(this.pattern.lr[1])];

        this.prCtx.fillRect(x0, 0, x1 - x0, this.pr.height)
        this.prCtx.fillStyle = 'rgba(200,200,255,0.5)'

        this.loopDragHandlePaths().forEach(path => { this.prCtx.fill(path); });

        this.prCtx.fillStyle = this.colors.noteH;
        this.selectedNoteIdxs.forEach(i => {
            this.prCtx.fill(this.pathOfNote(this.pattern.ns[i]));
        })

        this.drawOverlay();
    }

    drawOverlay() {

        this.proCtx.clearRect(0, 0, this.pr.width, this.pr.height);

        //draw cursor
        this.proCtx.strokeStyle = 'rgb(255,255,0)'
        this.proCtx.beginPath();
        this.proCtx.moveTo(this.timeToX(this.playingTime), 0);
        this.proCtx.lineTo(this.timeToX(this.playingTime), this.pr.height);
        this.proCtx.stroke();

        if (this.selectionCorners) {
            const [c0, c1] = this.selectionCorners;

            this.proCtx.strokeStyle = 'rgb(0,0,0)'
            this.proCtx.setLineDash([5, 5]);
            const [x0,y0] = [this.timeToX(c0.t),this.noteToY(c0.n)];
            this.proCtx.strokeRect(
                Math.min(x0, c1.x), Math.min(y0, c1.y),
                Math.abs(x0 - c1.x), Math.abs(y0- c1.y)
            );
            this.proCtx.setLineDash([])

        }

    }

    mouseEventToCanvasCoords(e) {
        return [e.clientX - this.pr.getBoundingClientRect().left,
        e.clientY - this.pr.getBoundingClientRect().top];
    }

    mouseEventToQTimeAndNote(e) {
        const [x, y] = this.mouseEventToCanvasCoords(e);
        return [this.floor(this.xToTime(x), this.quantBeats), Math.floor(this.yToNote(y))]
    }

    quantizeTime(t) {
        return this.floor(t, this.quantBeats)
    }

    pencilClick(e) {
        const [t, n] = [this.xToTime(e.x), this.yToNote(e.y)]
        const tq = this.quantizeTime(t);
        const note = [tq, tq + this.quantBeats, Math.floor(n), 100]
        this.addNote(note);
        this.selectedNoteIdxs = [this.pattern.ns.length-1]//.push(this.pattern.ns.length - 1);
        this.selectionCorners = null;
    }

    // pan(e){
    //     var dx = -e.movementX*( this.visibleTimeRange[1] - this.visibleTimeRange[0])/this.pr.width;
    //     this.visibleTimeRange[0] += dx;
    //     this.visibleTimeRange[1] += dx;

    //     var dy = e.movementY*(this.visibleNoteRange[1]-this.visibleNoteRange[0])/this.pr.height;

    //     this.visibleNoteRange[0] += dy;
    //     this.visibleNoteRange[1] += dy;

    //     this.draw();
    // }

    // zoom(e){
    //     var dy = Math.pow(1.011,e.movementY);

    //     // console.log(dy);
    //     const x = this.mouseEventToCanvasCoords(e)[0];
    //     const t = this.xToTime(x);

    //     // visibleTimeRange[0] = dx;
    //     this.visibleTimeRange[0] = t + (this.visibleTimeRange[0]-t)*dy;
    //     this.visibleTimeRange[1] = t + (this.visibleTimeRange[1]-t)*dy;

    //      var dx = e.movementX;


    //     if(dx > 5 || dx < -5  ){
    //         this.visibleNoteRange[0] += Math.sign(dx);
    //         this.visibleNoteRange[1] -= Math.sign(dx);
    //     }
    //     if ( this.visibleNoteRange[1] <= this.visibleNoteRange[0]){
    //         this.visibleNoteRange[0] -= 1;
    //         this.visibleNoteRange[1] += 1;
    //     }

    //     [0,1].forEach( i => {
    //         if( this.visibleNoteRange[i] > 127 ) {this.visibleNoteRange[i]=127;}
    //         if( this.visibleNoteRange[i] < 0   ) {this.visibleNoteRange[i]=0;}
    //     })

    //     // console.log(visibleNoteRange)
    //     this.draw();
    // }

} ///HTMLElement


export default PianoRoll