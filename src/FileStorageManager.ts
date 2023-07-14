import path from "path";
import fs from "fs" ;

export class FileStorageManager {
    private dir_ : string ;

    constructor(dir: string) {
        this.dir_ = dir ;

        if (!fs.existsSync(this.dir_)) {
            fs.mkdirSync(this.dir_) ;
        }
        else if (!fs.statSync(this.dir_).isDirectory()) {
            throw new Error("path '" + this.dir_ + "' exists but is not a directory") ;
        }

        if (!fs.existsSync(this.dir_)) {
            throw new Error("cannot create directory '" + this.dir_ + "' to store files") ;
        }
    }

    private getFileName() : string {
        let num: number = 1 ;
        let fullname: string = '' ;
        while (true) {
            let fname: string = String(num) ;
            fname = 'file-' + fname.padStart(8, '0');
            fullname = path.join(this.dir_, fname)
            if (!fs.existsSync(fullname)) {
                break ;
            }
            num++ ;
        }

        return fullname ;
    }

    public storeFile(contents: Buffer) : string {
        let name: string = this.getFileName() ;

        fs.writeFile(name, contents,  "binary", function(err) 
            { 
                throw err;
            });
        return name ;
    }
}