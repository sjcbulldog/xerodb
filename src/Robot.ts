import { PartNumber } from "./PartNumber";

export class Robot {
    id_: number ;
    name_ : string ;
    description_ : string ;
    creator_: string ;
    created_ : string ;
    modified_ : string ;
    topparts_ : PartNumber[] ;

    constructor(id: number, name: string, desc: string, topid: PartNumber[], creator: string, created: string, modified: string) {
        this.id_ = id ;
        this.name_ = name ;
        this.description_ = desc ;
        this.topparts_ = topid ;
        this.creator_ = creator ;
        this.created_ = created ;
        this.modified_ = modified ;
    }
}
