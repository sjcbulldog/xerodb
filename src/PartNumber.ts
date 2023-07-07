
export class PartNumber {
    public static readonly RobotDigits : number = 3 ;
    public static readonly PartDigits: number = 5 ;

    robot_ : number ;
    abbrev_ : string ;
    part_ : number ;

    constructor(robot: number, abbrev: string, part: number) {
        this.robot_ = robot ;
        this.abbrev_ = abbrev ;
        this.part_ = part ;
    }

    public toString() : string {
        let rstr: string = String(this.robot_).padStart(PartNumber.RobotDigits, '0');
        let pstr: string = String(this.part_).padStart(PartNumber.PartDigits, '0');
        return rstr + '-' + this.abbrev_ + '-' + pstr ;
    }

    public static robotNumberToString(robot: number) : string {
        return String(robot).padStart(PartNumber.RobotDigits, '0') ;
    }

    public static fromString(str: string) : PartNumber | null {
        let parts: string[] = str.split('-') ;
        if (parts.length != 3) {
            return null ;
        }

        let r: number = parseInt(parts[0], 10);
        if (isNaN(r)) {
            return  null ;
        }

        let p: number = parseInt(parts[2], 10) ;
        if (isNaN(p)) {
            return null ;
        }

        return new PartNumber(r, parts[1], p) ;
    }
}