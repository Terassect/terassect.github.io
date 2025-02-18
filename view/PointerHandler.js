console.log("PointerHandler.js loaded")

class PointerHandler extends HTMLElement{

    constructor(){super();}

    downs = [];
    heldCoords = {};

    getCurrentlyHeld(){ return this.downs.map(d=>this.heldCoords[d.id])}

    doubleDrag(z,zPrev){}
    singleDrag(z,z0){}

    convertToLocal(event){
        const rect = this.getBoundingClientRect();
        const x0 = rect.left;
        const y0 = rect.top;
        return { x:event.x-x0, y:event.y-y0, id:event.pointerId }
    }

    connectedCallback() {
        document.addEventListener('contextmenu', function(event) { event.preventDefault(); });

        var s = this.style;
        s.width = "100%";
        s.height = "100%";
        s.position = "absolute";
        s.left = "0px";
        s.top = "0px";

        const rect = this.getBoundingClientRect();
        const x0 = rect.left;
        const y0 = rect.top;

        this.onpointerdown = (event) => {
            const e = this.convertToLocal(event)
            this.downs.push(structuredClone(e));
            this.heldCoords[e.id] = {x:e.x, y:e.y};
            console.log("pointer",e)
        }

        this.onpointerup = (e) =>{
            this.downs = this.downs.filter(d => {d.id != e.id});
        }

        this.onpointermove = (event) => {

            const e = this.convertToLocal(event)

            const hPrev = this.getCurrentlyHeld().slice();
            this.heldCoords[e.id] = {x:e.x,y:e.y}
            const h = this.getCurrentlyHeld().slice();

            if(this.downs.length == 1 ){
                this.singleDrag(h,this.downs[0]);
            }
            if(this.downs.length == 2 ) {
                this.doubleDrag(h,hPrev);
            }
        }
        console.log("PointerHandler connected" )
    }
}

export default PointerHandler