import { PartDrawing } from "./PartDrawing";
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
    files_: string[] ;
    links_: string[] ;
    donedate_: string;
    nextdate_: string;
    drawings_: PartDrawing[] ;
    attribs_ : Map<string, string> ;

    constructor(parent: PartNumber | null, num: PartNumber, state: string, quantity: number, desc: string, 
                type: string, uname: string, created: string, modified: string, mentor: string, student: string,
                files: string[], links: string[], donedate: string, nextdate: string, attribs: Map<string, string>) {
        this.parent_ = parent ;
        this.part_ = num ;
        this.state_ = state ;
        this.quantity_ = quantity ;
        this.description_ = desc ;
        this.type_ = type ;
        this.username_ = uname ;
        this.created_ = created ;
        this.modified_ = modified ;
        this.mentor_ = mentor;
        this.student_ = student;
        this.files_ = files ;
        this.links_ = links ;
        this.donedate_ = donedate ;
        this.nextdate_ = nextdate;
        this.drawings_ = [] ;
        if (attribs)
            this.attribs_ = attribs ;
        else
            this.attribs_ = new Map<string, string>();
    }
    
    public isChildOf(parent: PartNumber) : boolean {
        return this.parent_ !== null && this.parent_.toString() == parent.toString() ;
    }

    public doneDaysLate() : number {
        if (this.donedate_.length === 0)
            return Infinity;

        let ret: number = 0 ;
        let current: Date = new Date() ;
        let donedate: Date = new Date(this.donedate_);
        var diff = current.getTime() - donedate.getTime();
        if (diff > 0) {
            ret = Math.ceil(diff / (1000 * 3600 * 24)); 
        }

        return ret ;
    }

    public nextDaysLate() {
        if (this.nextdate_.length === 0)
            return Infinity;

        let ret: number = 0 ;
        let current: Date = new Date() ;
        let donedate: Date = new Date(this.nextdate_);
        var diff = current.getTime() - donedate.getTime();
        if (diff > 0) {
            ret = Math.floor(diff / (1000 * 3600 * 24)); 
        }

        return ret ;
    }

    public clone() : RobotPart {
        let ret: RobotPart = new RobotPart(this.parent_, this.part_, this.state_, this.quantity_, this.description_, 
                                    this.type_, this.username_, this.created_, this.modified_, 
                                    this.mentor_, this.student_, this.files_, this.links_, this.donedate_, 
                                    this.nextdate_, this.cloneAttribs());

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
