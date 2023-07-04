export class NextState
{
    next_ : string ;
    method_ : string ;

    constructor(next: string, method: string) {
        this.next_ = next;
        this.method_ = method ;
    }
}

export class PartState
{
    name_ : string ;
    next_ : NextState[];

    constructor(name: string, next: NextState[]) {
        this.name_ = name ;
        this.next_ = next ;
    }
}
