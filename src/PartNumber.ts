
export class PartNumber {
    robot_ : number ;
    abbrev_ : string ;
    part_ : number ;

    constructor(robot: number, abbrev: string, part: number) {
        this.robot_ = robot ;
        this.abbrev_ = abbrev ;
        this.part_ = part ;
    }

    public toString() : string {
        let rstr: string = String(this.robot_).padStart(3, '0');
        let pstr: string = String(this.robot_).padStart(5, '0');
        return rstr + '-' + this.abbrev_ + '-' + pstr ;
    }

    public static fromString(str: string) : PartNumber {
        let parts: string[] = str.split('-') ;
        if (parts.length != 3) {
            throw new Error('invalid part number - not 3 parts separated by a dash') ;
        }

        let r: number = parseInt(parts[0], 10);
        if (isNaN(r)) {
            throw new Error('invalid part number - first part is not a legal integer') ;
        }

        let p: number = parseInt(parts[2], 10) ;
        if (isNaN(p)) {
            throw new Error('invalid part number - third part is not a legal integer') ;
        }

        return new PartNumber(r, parts[1], p) ;
    }
}