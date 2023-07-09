
export function packFiles(list: string[]) : string {
    let str: string = '' ;

    for(let one of list) {
        if (str.length > 0) {
            str += ", " ;
        }

        str += one ;
    }

    return str ;
}

export function unpackFiles(str: string) : string[] {
    return str.split(',');
}

export function packLinks(list: string[]) : string {
    let str: string = '' ;

    for(let one of list) {
        if (str.length > 0) {
            str += ", " ;
        }

        str += one ;
    }

    return str ;
}

export function unpackLinks(str: string) : string[] {
    return str.split(',');
}
