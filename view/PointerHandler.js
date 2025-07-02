
class PointerHandler extends HTMLElement{
    log (m){
        logg(this.downs.length.toString() + " " + m)
    }

    constructor(){super();}

    downs = [];
    heldCoords = {};
    r0 = [];

    clickTimeout;

    getCurrentlyHeld(){ return this.downs.map(d=>this.heldCoords[d.id])}

    doubleUp(z,z0){}
    doubleDrag(z,zPrev){}
    doubleDown(z){}

    singleUp(z,z0){}
    singleDrag(z,zPrev,z0,e){}
    singleDown(z){}

    rightDrag(z,z0){}
    rightDown(z){}
    rightUp(z,z0){}

    convertToLocal(event){
        const rect = this.getBoundingClientRect();
        const x0 = rect.left;
        const y0 = rect.top;
        const e = {};
        e.x = event.x-x0;
        e.y = event.y-y0;
        e.id = event.pointerId;
        if(event.deltaX){e.deltaX = event.deltaX}
        if(event.deltaY){e.deltaY = event.deltaY}
        if(event.deltaX){e.deltaX = event.deltaX}
        if(event.deltaY){e.deltaY = event.deltaY}
        e.movementX = event.movementX;
        e.movementY = event.movementY;
        return e;
    }

    connectedCallback() {
        this.touchAction = "none"
        document.oncontextmenu = (e) => {e.preventDefault();}
        var s = this.style;
        s.touchAction = "none";
        s.width = "100%";
        s.height = "100%";
        s.position = "absolute";
        s.left = "0px";
        s.top = "0px";

        this.onpointerdown = (event) => {
            const e = this.convertToLocal(event)
            if(event.buttons == 2){
                this.r0=e;
                this.rightDown(e);
            }

            if(event.buttons != 1){return;}

            this.downs.push(e);
            this.heldCoords[e.id] = {x:e.x, y:e.y};

            if(this.downs.length == 1){
                this.clickTimeout = setTimeout(()=>{this.clickTimeout=null;},100)
                this.singleDown(this.downs[0])
            } 

            if(this.downs.length == 2){this.doubleDown(this.downs[1])}


        }

        this.onpointerup = (event) => {
            const e = this.convertToLocal(event)

            if(this.downs.length == 1){ this.singleUp(e, this.downs[0]) }
            if(this.downs.length == 2){ this.doubleUp(e, this.downs[0]) }

            this.downs = this.downs.filter(d => d.id != e.id);
        }

        this.onmouseleave = (e)=>{
            this.onpointerup(e)
        }

        this.onpointermove = (event) => {
            const e = this.convertToLocal(event)

            if(event.buttons == 2)
            {
                this.rightDrag(e)
            }

            if(this.clickTimeout || event.buttons != 1){return;}


            const hPrev = this.getCurrentlyHeld().slice();
            this.heldCoords[e.id] = { x:e.x, y:e.y }
            const h = this.getCurrentlyHeld().slice();

            if(this.downs.length == 1 ){
                this.singleDrag(h[0],hPrev[0],this.downs[0],event);
            }
            if(this.downs.length == 2 ) {
                this.doubleDrag(h,hPrev);
            }
        }
        

        console.log("PointerHandler connected" )
    }
}

export default PointerHandler