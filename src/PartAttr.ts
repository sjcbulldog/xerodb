export class PartAttr {
    public static readonly TypeStringName = "string" ;
    public static readonly TypeIntName = "int" ;
    public static readonly TypeDoubleName = "double" ;

    name_ : string ;
    type_ : string ;
    required_ : boolean ;
    default_ : string ;

    constructor(name: string, type: string, required: boolean, def: string) {
        if (type !== PartAttr.TypeDoubleName && type !== PartAttr.TypeIntName && type !== PartAttr.TypeStringName) {
            throw new Error('invalid PartAttr type "' + type + '" - only "int", "double", or "string" is valid');
        }

        this.name_ = name ;
        this.type_ = type ;
        this.required_ = required ;
        this.default_ = def ;
    }
}
