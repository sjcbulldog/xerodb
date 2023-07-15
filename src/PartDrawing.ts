
export class PartDrawing {
    file_or_url_: string ;
    desc_: string ;
    remote_file_: string | undefined ;
    version_: number ;
    set_: number ;

    constructor(version: number, set: number, file_url: string, desc: string, name?: string) {
        this.version_ = version ;
        this.set_ = set ;
        this.file_or_url_ = file_url ;
        this.desc_ = desc ;
        this.remote_file_ = name ;
    }
}