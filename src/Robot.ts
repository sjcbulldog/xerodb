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
    parent_ : number;
    robot_ : number ;
    part_ : number;
    state_ : string;
    quantity_ : number ;
    description_ : string ;
    type_ : string;
    username_ : string;
    created_ : string;
    modified_ : string ;
    attribs_ : Map<string, string> ;

    constructor(parent: number, robot: number, part: number, state: string, quantity: number, desc: string, type: string, uname: string, created: string, modified: string, attribs: Map<string, string>) {
        this.parent_ = parent ;
        this.robot_ = robot ;
        this.part_ = part ;
        this.state_ = state ;
        this.quantity_ = quantity ;
        this.description_ = desc ;
        this.type_ = type ;
        this.username_ = uname ;
        this.created_ = created ;
        this.modified_ = modified ;
        if (attribs)
            this.attribs_ = attribs ;
        else
            this.attribs_ = new Map<string, string>();
    }
}