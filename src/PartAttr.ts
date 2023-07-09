export class PartAttr {
    public static readonly TypeStringName = "string" ;
    public static readonly TypeIntName = "int" ;
    public static readonly TypeDoubleName = "double" ;
    public static readonly TypeMentorName = "mentor" ;
    public static readonly TypeStudentName = "student" ;
    public static readonly TypeCurrencyName = "currency" ;
    public static readonly TypeChoiceName = "choice" ;

    name_ : string ;
    type_ : string ;
    required_ : boolean ;
    default_ : string ;
    choices_ : string[] ;

    constructor(name: string, type: string, required: boolean, def: string) {
        this.name_ = name ;
        this.type_ = type ;
        this.required_ = required ;
        this.default_ = def ;
        this.choices_ = [] ;
    }

    public setChoices(c: string[]) : PartAttr {
        this.choices_ = c ;
        return this ;
    }
}
