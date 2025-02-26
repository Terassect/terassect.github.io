
class PointerHandler extends HTMLElement{
    log (m){
        logg(this.downs.length.toString() + " " + m)
    }

    constructor(){super();}

    downs = [];
    heldCoords = {};

    clickTimeout;

    getCurrentlyHeld(){ return this.downs.map(d=>this.heldCoords[d.id])}

    doubleUp(z,z0){}
    doubleDrag(z,zPrev){}
    doubleDown(z){}

    singleUp(z,z0){}
    singleDrag(z,zPrev,z0){}
    singleDown(z){}

    convertToLocal(event){
        const rect = this.getBoundingClientRect();
        const x0 = rect.left;
        const y0 = rect.top;
        return { x:event.x-x0, y:event.y-y0, id:event.pointerId }
    }

    connectedCallback() {
        document.oncontextmenu = (e) => {e.preventDefault();}
        var s = this.style;
        s.width = "100%";
        s.height = "100%";
        s.position = "absolute";
        s.left = "0px";
        s.top = "0px";

        this.onpointerdown = (event) => {
            const e = this.convertToLocal(event)
            this.downs.push(e);
            this.heldCoords[e.id] = {x:e.x, y:e.y};

            if(this.downs.length == 1){
                this.clickTimeout = setTimeout(()=>{this.clickTimeout=null;},100)
                this.singleDown(this.downs[0])
            } 
            // if (this.downs.length > 1 && this.clickTimeout){ this.clickTimeout = null;}

            if(this.downs.length == 2){this.doubleDown(this.downs[1])}

            this.log("down" + e.id  );

        }

        this.onpointerup = (event) => {
            this.log("up")
            const e = this.convertToLocal(event)
            if(this.downs.length == 1){this.singleUp(e, this.downs[0])}
            if(this.downs.length == 2){ this.doubleUp(e, this.downs[0]) }
            this.log("\t" + e.id?.toString() + " " + JSON.stringify(this.downs.map(d=>d.id)))
            this.downs = this.downs.filter(d => d.id != e.id);
            this.log( "\t" + e.id?.toString()+" " +JSON.stringify(this.downs.map(d=>d.id)) )

            if(this.downs.length == 0){this.log("\n")}
        }

        this.onmouseleave = (e)=>{
            this.log("leave\n")
            this.onpointerup(e)
        }

        this.onpointermove = (event) => {
            if(this.clickTimeout){return;}

            const e = this.convertToLocal(event)

            const hPrev = this.getCurrentlyHeld().slice();
            this.heldCoords[e.id] = {x:e.x,y:e.y}
            const h = this.getCurrentlyHeld().slice();

            if(this.downs.length == 1 ){
                this.singleDrag(h[0],hPrev[0],this.downs[0]);
            }
            if(this.downs.length == 2 ) {
                this.doubleDrag(h,hPrev);
            }
        }
        console.log("PointerHandler connected" )
    }
}

export default PointerHandler