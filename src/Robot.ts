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
    robot_ : number ;
    part_ : number;
    parent_ : number;
    description_ : string ;
    type_ : string;
    attribs_ : Map<string, string> ;

    constructor(parent: number, robot: number, part: number, desc: string, type: string) {
        this.parent_ = parent ;
        this.robot_ = robot ;
        this.part_ = part ;
        this.description_ = desc ;
        this.type_ = type ;
        this.attribs_ = new Map<string, string>();
    }
}