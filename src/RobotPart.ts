import { PartNumber } from "./PartNumber";

export class RobotPart {
    parent_ : PartNumber | null ;
    part_ : PartNumber;
    state_ : string;
    student_ : string ;
    mentor_: string ;
    quantity_ : number ;
    description_ : string ;
    type_ : string;
    username_ : string;
    created_ : string;
    modified_ : string ;
    attribs_ : Map<string, string> ;

    constructor(parent: PartNumber | null, num: PartNumber, state: string, quantity: number, desc: string, type: string, uname: string, created: string, modified: string, attribs: Map<string, string>) {
        this.parent_ = parent ;
        this.part_ = num ;
        this.state_ = state ;
        this.quantity_ = quantity ;
        this.description_ = desc ;
        this.type_ = type ;
        this.username_ = uname ;
        this.created_ = created ;
        this.modified_ = modified ;
        this.mentor_ = "" ;
        this.student_ = "" ;
        if (attribs)
            this.attribs_ = attribs ;
        else
            this.attribs_ = new Map<string, string>();
    }

    public clone() : RobotPart {
        let ret: RobotPart = new RobotPart(this.parent_, this.part_, this.state_, this.quantity_, this.description_, this.type_, this.username_, this.created_, this.modified_, this.cloneAttribs());
        ret.mentor_ = this.mentor_ ;
        ret.student_ = this.student_

        return ret;
    }

    private cloneAttribs() : Map<string, string> {
        let ret: Map<string, string> = new Map<string, string>() ;
        for( let [key, value] of this.attribs_) {
            ret.set(key, value) ;
        }
        return ret ;
    }
}