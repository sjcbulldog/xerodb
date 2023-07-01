export class Robot {
    id_: number ;
    name_ : string ;
    description_ : string ;
    creator_: string ;
    created_ : string ;
    modified_ : string ;
    topid_ : number ;

    constructor(id: number, name: string, desc: string, topid: number, creator: string, created: string, modified: string) {
        this.id_ = id ;
        this.name_ = name ;
        this.description_ = desc ;
        this.topid_ = topid ;
        this.creator_ = creator ;
        this.created_ = created ;
        this.modified_ = modified ;
    }
}

export class RobotPart {
    id_ : number ;
    partno_ : string ;
    description_ : string ;
    type_ : string;
    attribs_ : Map<string, string> ;

    constructor(id: number, partno: string, desc: string, type: string, specid: number) {
        this.id_ = id ;
        this.partno_ = partno ;
        this.description_ = desc ;
        this.type_ = type ;
        this.attribs_ = new Map<string, string>();
    }
}