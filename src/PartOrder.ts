export class OneInstance {
    public path_: string[] ;
    public quantity_ : number ;
    public unitcost_ : number ;

    constructor(path: string[], quan: number, unitcost: number) {
        this.path_ = path ;
        this.quantity_ = quan ;
        this.unitcost_ = unitcost ;
    }
}


export class PartOrder {
    desc_: string ;
    instances_ : OneInstance[] ;

    constructor(desc: string) {
        this.desc_ = desc ;
        this.instances_ = [] ;
    }

    public addInstance(inst: OneInstance) {
        this.instances_.push(inst);
    }

    public totalQuantity() : number {
        let ret: number = 0 ;
        for(let inst of this.instances_) {
            ret += inst.quantity_ ;
        }

        return ret ;
    }

    public cost() : number {
        let cost: number = Infinity ;

        for(let inst of this.instances_) {
            if (cost === Infinity) {
                cost = inst.unitcost_ ;
            }
            else if (cost !== inst.unitcost_) {
                cost = Infinity ;
                break ;
            }
        }

        return cost ;
    }
}
