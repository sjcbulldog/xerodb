import path from "path";
import fs from "fs";
import { DatabaseService } from "./DatabaseService";
import { RobotService } from "./RobotService";
import { User } from "./User";
import { UserService } from "./UserService";
import { xeroDBLoggerLog } from "./logger";
import { Response, Request } from 'express';
import { FileStorageManager } from "./FileStorageManager";
import { createMessageHtml, processPage } from "./pagegen";
import { PartNumber } from "./PartNumber";
import { PartDrawing } from "./PartDrawing";

interface LooseObject {
    [key: string]: any
};

export class DrawingsService extends DatabaseService {
    private static readonly userFileName: string = 'drawings.db';

    private robots_ : RobotService ;
    private users_ : UserService ;
    fsmgr_ : FileStorageManager;

    constructor(rootdir: string, robots: RobotService, users: UserService) {
        super('drawing', path.join(rootdir, DrawingsService.userFileName));

        this.robots_  = robots ;
        this.users_ = users ;
        this.fsmgr_ = new FileStorageManager(path.join(rootdir, 'files'));

        this.robots_.setDrawingsService(this);
    }

    protected createTables() {
        let sql =
            `CREATE TABLE drawings (
                partno text not null,
                filename text not null,
                localfile text not null,
                version int not null,
                setno int not null,
                desc text not null);
            ` ;
            this.db().exec(sql, (err) => {
                if (err) {
                    let msg: string = this.name() + ": cannot create table 'drawings' in DrawingsService" ;
                    xeroDBLoggerLog('ERROR', msg);
                    throw new Error(msg)
                }
            });          
    }

    public getDrawings(partno: PartNumber) : Promise<PartDrawing[]> {
        let ret: Promise<PartDrawing[]> = new Promise<PartDrawing[]>((resolve, reject) => {
            let sql = "select partno, version, setno, filename, localfile, desc from drawings where partno='" + partno.toString() + 
                        "' order by setno, version" ;
            this.db().all(sql, async (err, rows) => {
                if (err) {
                    reject(err);
                }
                else {
                    let ret: PartDrawing[] = [] ;

                    for (let row of rows) {  
                        let obj: Object = row as Object;
                        type ObjectKey = keyof typeof obj;
                        const partnoKey = 'partno' as ObjectKey;
                        const versionKey = 'version' as ObjectKey;
                        const setKey = 'setno' as ObjectKey;
                        const filenameKey = 'filename' as ObjectKey;
                        const descKey = 'desc' as ObjectKey;
                        const localfileKey = 'localfile' as ObjectKey ;

                        let partno = (obj[partnoKey] as unknown) as string;
                        let version = (obj[versionKey] as unknown) as number ;
                        let set = (obj[setKey] as unknown) as number ;
                        let filename = (obj[filenameKey] as unknown) as string;
                        let desc = (obj[descKey] as unknown) as string;
                        let localfile = (obj[localfileKey] as unknown) as string ;                    

                        if (localfile.length > 0)
                            ret.push(new PartDrawing(version, set, localfile, desc, filename)) ;
                        else
                            ret.push(new PartDrawing(version, set, filename, desc));
                    }
                    resolve(ret);
                }
            });            
        }) ;
        return ret ;
    }

    public getOneDrawing(partno: PartNumber, setno: number, version: number) : Promise<PartDrawing> {
        let ret: Promise<PartDrawing> = new Promise<PartDrawing>((resolve, reject) => {
            let sql = "select partno, version, setno, filename, localfile, desc from drawings where partno='" + partno.toString() + 
                        "' AND setno=" + setno + " AND version=" + version ;
            this.db().all(sql, async (err, rows) => {
                if (err) {
                    reject(err);
                }
                else {
                    let retval: PartDrawing ;

                    let row = rows[0];
                    let obj: Object = row as Object;
                    type ObjectKey = keyof typeof obj;
                    const partnoKey = 'partno' as ObjectKey;
                    const versionKey = 'version' as ObjectKey;
                    const setKey = 'setno' as ObjectKey;
                    const filenameKey = 'filename' as ObjectKey;
                    const descKey = 'desc' as ObjectKey;
                    const localfileKey = 'localfile' as ObjectKey ;

                    let partno = (obj[partnoKey] as unknown) as string;
                    let version = (obj[versionKey] as unknown) as number ;
                    let set = (obj[setKey] as unknown) as number ;
                    let filename = (obj[filenameKey] as unknown) as string;
                    let desc = (obj[descKey] as unknown) as string;
                    let localfile = (obj[localfileKey] as unknown) as string ;                    

                    if (localfile.length > 0)
                        retval = new PartDrawing(version, set, localfile, desc, filename) ;
                    else
                        retval = new PartDrawing(version, set, filename, desc);

                    resolve(retval);
                }
            });            
        }) ;
        return ret ;
    }

    private storeLink(partno: string, version: number, set: number, desc: string, link: string) : Promise<void> {
        let ret: Promise<void> = new Promise<void>(async (resolve, reject) => {
            let sql = 'INSERT INTO drawings VALUES (';
                sql += "'" + partno + "',";
                sql += "'',";
                sql += "'" + link + "',";
                sql += version + ",";
                sql += set + "," ;
                sql += "'" + desc + "');";

            await this.db().exec(sql, (err) => {
                if (err) {
                    reject(err);
                }
            });
            
            resolve() ;
        }) ;

        return ret;
    }

    private storeFile(partno: string, name: string, version: number, set: number, desc: string, data:Buffer) : Promise<string> {
        let ret: Promise<string> = new Promise<string>(async (resolve, reject) => {
            let fname: string = this.fsmgr_.storeFile(data);

            let sql = 'INSERT INTO drawings VALUES (';
                sql += "'" + partno + "',";
                sql += "'" + name + "',";
                sql += "'" + fname + "',";
                sql += version + ",";
                sql += set + "," ;
                sql += "'" + desc + "');";

            await this.db().exec(sql, (err) => {
                if (err) {
                    reject(err);
                }
            });
            
            resolve(fname) ;
        }) ;

        return ret ;
    }

    private getNewSetNumber(partno: PartNumber) : Promise<number> {
        let ret: Promise<number> = new Promise<number>(async (resolve, reject) => {
            let drawings: PartDrawing[] = await this.getDrawings(partno) ;

            let maxset:number = 0 ;
            for(let one of drawings) {
                if (one.set_ > maxset) {
                    maxset = one.set_ ;
                }
            }
            resolve(maxset + 1);
        }) ;
        return ret ;
    }

    private getNewVersionNumber(partno: PartNumber, setnum: number) : Promise<number> {
        let ret: Promise<number> = new Promise<number>(async (resolve, reject) => {
            let drawings: PartDrawing[] = await this.getDrawings(partno) ;

            let maxver:number = 1 ;
            for(let one of drawings) {
                if (one.set_ === setnum && one.version_ > maxver) {
                    maxver = one.version_ ;
                }
            }
            resolve(maxver + 1);
        }) ;
        return ret ;
    }

    private drawingsToLoose(drawings: PartDrawing[]) : LooseObject[] {
        let ret: LooseObject[] = [] ;

        if (drawings.length > 0) {
            let curset: number = 0 ;
            for(let one of drawings) {
                let lobj: LooseObject = {} ;
                if (one.set_ !== curset) {
                    // This is a new entry in a set, put the full line
                    lobj.title = one.desc_ ;
                    curset = one.set_ ;
                }
                else {
                    // This is a different version, 
                    lobj.title = '' ;
                }

                if (one.remote_file_) {
                    lobj.dtype = 'Drawing File' ;
                    lobj.filename = one.remote_file_ ;
                }
                else {
                    lobj.dtype = 'Drawing Link' ;
                    lobj.filename = one.file_or_url_ ;
                }

                lobj.version = one.version_ ;
                lobj.set = one.set_ ;
                ret.push(lobj);
            }
        }

        return ret ;
    }

    private async adddrawing(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.body.partno === undefined) {
            res.json({ error: 'invalid api REST request /drawings/editpart - missing query parameters'});
            return;
        }

        let partno: PartNumber | null = PartNumber.fromString(req.body.partno) ;
        if (partno === null) {
            res.json({ error: 'invalid ROBOT api REST request /drawings/editpart - invalid part number'});
            return;
        }

        let setnum: number ;
        
        try {
            setnum = await this.getNewSetNumber(req.body.partno);
        }
        catch(err) {
            let errobj: Error = err as Error ;
            res.json({error: errobj.message}) ;
            return ;
        }

        let lobj : LooseObject = req as LooseObject ;
        let fname: string = await this.storeFile(req.body.partno, lobj.files.drawing.name, 1, setnum, req.body.desc, 
                                                    lobj.files.drawing.data);

        res.json({});
    }

    private async adddrawingversion(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.body.partno === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /drawings/adddrawingversion - missing query parameters'));
            return;
        }

        let partno: PartNumber | null = PartNumber.fromString(req.body.partno) ;
        if (partno === null) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /drawings/adddrawingversion - invalid part number'));
            return;
        }

        if (req.body.set === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /drawings/adddrawingversion - missing query parameters'));
            return;
        }

        let setnum: number = parseInt(req.body.set) ;
        if (isNaN(setnum)) {
            res.send(createMessageHtml('Error', 'invalid api REST request /drawings/adddrawingversion - invalid drawing set'));
            return;
        }

        let version: number = await this.getNewVersionNumber(partno, setnum) ;

        let lobj : LooseObject = req as LooseObject ;
        let fname: string = await this.storeFile(req.body.partno, lobj.files.drawing.name, version, setnum, req.body.desc, 
                                                    lobj.files.drawing.data);
                                                    
        res.json({});
    }

    private async addlink(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.body.partno === undefined) {
            res.json({ error: 'invalid api REST request /drawings/editpart - missing query parameters'});
            return;
        }

        let partno: PartNumber | null = PartNumber.fromString(req.body.partno) ;
        if (partno === null) {
            res.json({ error: 'invalid ROBOT api REST request /drawings/editpart - invalid part number'});
            return;
        }

        if (req.body.link === undefined) {
            res.json({ error: 'invalid api REST request /drawings/editpart - missing query parameters'});
            return;            
        }

        let setnum: number ;
        
        try {
            setnum = await this.getNewSetNumber(req.body.partno);
        }
        catch(err) {
            let errobj: Error = err as Error ;
            res.json({error: errobj.message}) ;
            return ;
        }

        let lobj : LooseObject = req as LooseObject ;
        await this.storeLink(req.body.partno, 1, setnum, req.body.desc, req.body.link);

        res.json({});
    }
    
    private async addlinkversion(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.body.partno === undefined) {
            res.json({ error: 'invalid api REST request /drawings/editpart - missing query parameters'});
            return;
        }

        let partno: PartNumber | null = PartNumber.fromString(req.body.partno) ;
        if (partno === null) {
            res.json({ error: 'invalid ROBOT api REST request /drawings/editpart - invalid part number'});
            return;
        }

        if (req.body.link === undefined) {
            res.json({ error: 'invalid api REST request /drawings/editpart - missing query parameters'});
            return;            
        }

        let setnum: number = parseInt(req.body.set) ;
        if (isNaN(setnum)) {
            res.send(createMessageHtml('Error', 'invalid api REST request /drawings/adddrawingversion - invalid drawing set'));
            return;
        }

        let version: number = await this.getNewVersionNumber(partno, setnum) ;

        let lobj : LooseObject = req as LooseObject ;
        await this.storeLink(req.body.partno, version, setnum, req.body.desc, req.body.link);

        res.json({});
    }

    private async drawings(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.query.partno === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /drawings/editpart - missing query parameters'));
            return;
        }

        let partno: PartNumber | null = PartNumber.fromString(req.query.partno) ;
        if (partno === null) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /drawings/editpart - invalid part number'));
            return;
        }
        
        let vars: Map<string, string> = new Map<string, string>();
        vars.set('$$$PARTNO$$$', req.query.partno);
        res.send(processPage(vars, '/normal/drawings.html'));        
    }

    private async drawingslist(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.query.partno === undefined) {
            res.json([
                { title: 'invalid api REST request /drawings/drawingslist - missing query parameters' }
            ]) ;
            return;
        }

        let partno: PartNumber | null = PartNumber.fromString(req.query.partno) ;
        if (partno === null) {
            res.json([
                { title: 'invalid ROBOT api REST request /drawings/drawingslist - invalid part number' }
            ]) ;
            return;
        }

        let drawings = await this.getDrawings(partno) ;

        let json : LooseObject[] = this.drawingsToLoose(drawings) ;

        res.json(json);
    }

    private async delete(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.body.partno === undefined) {
            res.json({ error: 'invalid api REST request /drawings/delete - missing query parameters'});
            return;
        }

        let partno: PartNumber | null = PartNumber.fromString(req.body.partno) ;
        if (partno === null) {
            res.json({ error: 'invalid ROBOT api REST request /drawings/delete - invalid part number'});
            return;
        }

        let setnum: number = parseInt(req.body.set) ;
        if (isNaN(setnum)) {
            res.send(createMessageHtml('Error', 'invalid api REST request /drawings/delete - invalid drawing set'));
            return;
        }

        let version: number = parseInt(req.body.version) ;
        if (isNaN(version)) {
            res.send(createMessageHtml('Error', 'invalid api REST request /drawings/delete - invalid drawing version'));
            return;
        }

        let sql = "DELETE from drawings where partno='" + req.body.partno + "' AND setno=" + setnum + 
                        " AND version=" + version ;
        
        this.db().exec(sql, (err) => {
            if (err) {
                xeroDBLoggerLog('ERROR', 'RobotService: failed to update part (delete)time - ' + err.message);
                xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
            }
        });
    }

    private async show(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.query.partno === undefined) {
            res.json({ error: 'invalid api REST request /drawings/show - missing query parameters'});
            return;
        }

        let partno: PartNumber | null = PartNumber.fromString(req.query.partno) ;
        if (partno === null) {
            res.json({ error: 'invalid ROBOT api REST request /drawings/show - invalid part number'});
            return;
        }

        let setnum: number = parseInt(req.query.set) ;
        if (isNaN(setnum)) {
            res.send(createMessageHtml('Error', 'invalid api REST request /drawings/show - invalid drawing set'));
            return;
        }

        let version: number = parseInt(req.query.version) ;
        if (isNaN(version)) {
            res.send(createMessageHtml('Error', 'invalid api REST request /drawings/show - invalid drawing version'));
            return;
        }

        let drawing: PartDrawing = await this.getOneDrawing(partno, setnum, version) ;

        if (drawing.isLink()) {
            res.redirect(drawing.file_or_url_) ;
        }
        else {
            let buffer: Buffer = fs.readFileSync(drawing.file_or_url_);
            let ext: string = path.extname(drawing.remote_file_!);
            res.type(ext);
            res.send(buffer);
        }
    }

    public get(req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        xeroDBLoggerLog('DEBUG', "HistoryService: rest api '" + req.path + "'");

        let u: User | null = this.users_.userFromRequest(req);
        if (u === null) {
            xeroDBLoggerLog('ERROR', "RobotService: rest api '" + req.path + "' with invalid user");
            let ret: LooseObject = {
                loggedin: false, 
                error: 'You are not logged into the system.' 
            } ;
            res.json(ret) ;
            return ;
        }

        let handled: boolean = false;

        if (req.path === '/drawings/adddrawing') {
            this.adddrawing(u, req, res);
            handled = true ;
        }
        else if (req.path === '/drawings/adddrawingversion') {
            this.adddrawingversion(u, req, res);
            handled = true ;
        }
        else if (req.path === '/drawings/addlink') {
            this.addlink(u, req, res);
            handled = true ;
        }
        else if (req.path === '/drawings/addlinkversion') {
            this.addlinkversion(u, req, res);
            handled = true ;
        }
        else if (req.path === '/drawings/drawings') {
            this.drawings(u, req, res);
            handled = true ;
        }
        else if (req.path === '/drawings/drawingslist') {
            this.drawingslist(u, req, res);
            handled = true ;
        }
        else if (req.path === '/drawings/delete') {
            this.delete(u, req, res);
            handled = true ;
        }
        else if (req.path === '/drawings/show') {
            this.show(u, req, res);
            handled = true ;
        }

        if (!handled) {
            let msg: string = 'unknown history REST API request "' + req.path + "'";
            let ret: LooseObject = { error: msg } ;
            res.json(ret) ;
        }
    }
}
