import sqlite3 from 'sqlite3' ;
import { Response, Request } from 'express' ;
import path from 'path';
import { Robot, RobotPart } from "./Robot";
import { createMessageHtml, processPage } from './pagegen';
import { UserService } from './UserService';
import { User } from './User';
import { xeroDBLoggerLog } from './logger';

//
// Part numbers
//   RRRR PPPPPP
//   Robot Number - three digits (0-9)
//   Part Number - six digits (0-9)
//

interface LooseObject {
    [key: string]: any
} ;

export class RobotService {
    private static readonly robotFileName: string = 'robot.db' ;
    private static readonly missingErrorMessage: string = 'SQLITE_CANTOPEN' ;
    private static readonly lettersString: string = 'abcdefghijklmnopqrstuvwxzyzABCDEFGHIJKLMNOPQRSTUVWXYZ' ;
    private static readonly numbersString: string = '0123456789' ;
    private static readonly partTypeCOTS: string = 'C' ;
    private static readonly partTypeAssembly: string = 'A' ;
    private static readonly partTypeManufactured: string = 'M' ;

    private static readonly robotNumberLength: number = 3 ;
    private static readonly partNumberLength: number = 4 ;

    nextkey_ : number ;
    dbpath_ : string ;
    db_ : sqlite3.Database;
    robots_ : Map<number, Robot> ;
    users_ : UserService ;
    nextpart_ : Map<number, number> ;

    constructor(users: UserService, rootdir: string) {
        this.users_ = users ;
        this.nextkey_ = 1 ;
        this.robots_ = new Map<number, Robot>() ;
        this.nextpart_ = new Map<number, number>() ;
        this.dbpath_ = path.join(rootdir, RobotService.robotFileName);

        this.db_ = new sqlite3.Database(this.dbpath_, sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
                if (err.message.startsWith(RobotService.missingErrorMessage)) {
                    this.createDatabaseAndTables() ;
                    return ;
                }
                else {
                    throw new Error('UserService: error opening sqlite database');
                }
            }
            else {
                this.loadAll() ;
            }
        }) ;
    }

    private createDatabaseAndTables() {
        xeroDBLoggerLog('INFO', 'RobotService: creating new database at path "' + this.dbpath_ + '"') ;
        this.db_ = new sqlite3.Database(this.dbpath_, (err) => {
            if (err) {
                throw new Error('RobotService: error creating sqlite database - ' + err.message);
            }
            else {
                this.createTables() ;
            }
        }) ;
    }

    private createTables() {
        let sql = 
            `CREATE TABLE robots (
                id int primary key not null,
                name text not null,
                desc text not null,
                username text not null,
                created text not null,
                modified text not null,
                part text not null);
            ` ;
        this.db_.exec(sql);

        sql = 
        `CREATE TABLE parts (
            parent int not null,
            robotid int not null,
            partno int not null,
            desc text not null,
            type text not null,
            username text not null,
            created text not null,
            modified text not null, 
            attribs text);
        ` ;

        this.db_.exec(sql)
    }

    private loadAll() {
        let sql =
            `
            select id, name, desc, username, created, modified, part from robots;
            `;
        this.db_.all(sql, (err, rows) => {
            rows.forEach(row => {
                let obj: Object = row as Object;
                type ObjectKey = keyof typeof obj;
                const idKey = 'id' as ObjectKey;
                const nameKey = 'name' as ObjectKey;
                const descKey = 'desc' as ObjectKey;
                const usernameKey = 'username' as ObjectKey;
                const createdKey = 'created' as ObjectKey;
                const modifiedKey = 'modified' as ObjectKey;
                const partKey = 'part' as ObjectKey;

                let id = (obj[idKey] as unknown) as number;
                let name = obj[nameKey] as unknown;
                let desc = obj[descKey] as unknown;
                let username = obj[usernameKey] as unknown;
                let created = obj[createdKey] as unknown;
                let modified = obj[modifiedKey] as unknown;
                let part = obj[partKey] as unknown;
                let r: Robot = new Robot(id, name as string, desc as string, part as number, username as string, created as string, modified as string) ;
                this.robots_.set(id, r);

                if (this.nextkey_ < id + 1) {
                    this.nextkey_ = id + 1;
                }
            })
        });        
    }

    private attribMapToString(attribs: Map<string, string>) {
        let str: string = "" ;
        for(let [key, value] of attribs) {
            if (str.length > 0) {
                str += "," ;
            }
            str += '"' ;
            str += value ;
            str += '"' ;
        }
        return str ;
    }

    private stringToAttribMap(attribs: string) {
        let ret: Map<string, string> = new Map<string, string>();
        let index: number = 0 ;

        while (index < attribs.length) {
            //
            // Parse the key, all letters, numbers, and underscore
            //
            let key: string = "" ;
            while (index < attribs.length) {
                let ch = attribs.charAt(index);
                if (RobotService.lettersString.indexOf(ch) === -1 && RobotService.numbersString.indexOf(ch) === -1 && ch !== '_') {
                    break ;
                }

                key += ch ;
                index++ ;
            }

            if (index === attribs.length) {
                break ;
            }

            if (attribs.charAt(index) !== '=') {
                break ;
            }
            index++ ;

            if (attribs.charAt(index) !== '"') {
                break ;
            }
            index++ ;

            let value: string = "" ;
            while (index < attribs.length) {
                let ch = attribs.charAt(index);
                if (ch === '"') {
                    break ;
                }

                value += ch ;
                index++ ;
            }

            if (index === attribs.length)
                break ;

            index++;

            ret.set(key, value);
        }

        return ret;
    }

    private assertAttribsValid(attribs: Map<string, string>) {
        for(let [key, value] of attribs) {
            if (/^[a-zA-Z][a-zA-Z_0-9]*$/.test(key) === false) {
                throw new Error('part attributes invalid - key "' + key + '" contains an invalid character');
            }
            
            if (value.indexOf('"') !== -1 || value.indexOf("'") !== -1) {
                throw new Error('part attributes invalid - value "' + value + '" contains a quote character');            
            }
        }
    }

    private now() : string {
        let d: Date = new Date() ;
        return d.toLocaleString();
    }

    private async updateRobotModified(robot: number) {
        let sql: string = 'UPDATE robots SET ';
        sql += 'modified = "' + this.now() + '" ';
        sql += 'WHERE key="' + String(robot) + '"';
        this.db_.exec(sql, (err) => {
            if (err) {
                xeroDBLoggerLog('ERROR', 'RobotService: failed to update robot modified time, robot = "' + String(robot) + '" - ' + err) ;
                xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"') ;                
            }
        });
    }

    private async createNewPart(parent: number, robot: number, partno: number, type: string, desc: string, user: string, attribs: Map<string, string>) : Promise<void> {

        this.assertAttribsValid(attribs);

        let sql = 'INSERT INTO parts VALUES (' ;
        sql += String(parent) + "," ;
        sql += String(robot) + "," ;
        sql += String(partno) + ","
        sql += '"' + desc + '",' ;
        sql += '"' + type + '",' ;
        sql += '"' + user + '",' ;
        sql += '"' + this.now() + '",' ;
        sql += '"' + this.now() + '",' ;
        sql += "'" + this.attribMapToString(attribs) + "');" ;

        let ret: Promise<void> = new Promise<void>((resolve, reject) => {
            try {
                this.db_.exec(sql, (err) => {
                    if (err) {
                        xeroDBLoggerLog('ERROR', 'RobotService: failed to add part "' + this.partnoString(robot, partno) + '" to the database - ' + err) ;
                        xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"') ;
                        reject(err);
                    }
                    else {
                        let partnostr: string = this.partnoString(robot, partno) ;
                        this.users_.notify('part-added', 'A new part, number "' + partnostr + '" was added by "' + user + '"');
                        xeroDBLoggerLog('INFO', 'UserService: added part "' + this.partnoString(robot, partno) + '" to the database');
                        this.updateRobotModified(robot);
                        resolve() ;
                    }
                });
            }
            catch(err) {
                xeroDBLoggerLog('ERROR', 'createNewPart - sql threw exception');
            }
        }); 

        return ret;
    }

    private async getPartsForRobot(robot: number) : Promise<RobotPart[]> {
        let ret: Promise<RobotPart[]> = new Promise<RobotPart[]>((resolve, reject) => {
            let retval: RobotPart[] = [] ;
            let sql = 'select robotid, parent, partno, desc, type, username from parts where robotid=' + String(robot) + ';' ;
            this.db_.all(sql, async (err, rows) => {
                let maxpart: number = 0 ;
                for(let row of rows) {
                    let obj: Object = row as Object;
                    type ObjectKey = keyof typeof obj;
                    const parentKey = 'parent' as ObjectKey;
                    const partnoKey = 'partno' as ObjectKey;
                    const descKey = 'desc' as ObjectKey;
                    const typeKey = 'type' as ObjectKey;
                    const usernameKey = 'username' as ObjectKey ;
                    const createdKey = 'created' as ObjectKey ;
                    const modifiedKey = 'modified' as ObjectKey ;
                    const attribsKey = 'attribs' as ObjectKey;

                    let parent = (obj[parentKey] as unknown) as number;
                    let partno = (obj[partnoKey] as unknown) as number ;
                    let desc = (obj[descKey] as unknown) as string ;
                    let type = (obj[typeKey] as unknown) as string ;
                    let username = (obj[usernameKey] as unknown) as string ;
                    let created = (obj[createdKey] as unknown) as string ;
                    let modified = (obj[modifiedKey] as unknown) as string ;
                    let attribs = (obj[attribsKey] as unknown) as string ;

                    if (partno > maxpart) {
                        maxpart = partno ;
                    }

                    let attrlist : Map<string, string> ;
                    if (attribs === undefined) {
                        attrlist = new Map<string, string>() ;
                    } else {
                        attrlist = this.stringToAttribMap(attribs);
                    }

                    let partobj: RobotPart = new RobotPart(parent, robot, partno, desc, type, username, created, modified, attrlist);

                    retval.push(partobj);
                }

                maxpart++ ;
                this.nextpart_.set(robot, maxpart);
                resolve(retval) ;
            });
        }) ;
        return ret ;
    }

    private partnoString(robot: number, part: number) : string {
        let rstr: string = String(robot) ;
        while (rstr.length < RobotService.robotNumberLength){
            rstr = '0' + rstr ;
        }

        let pstr: string = String(part) ;
        while (pstr.length < RobotService.partNumberLength){
            pstr = '0' + pstr ;
        }

        return rstr + '-' + pstr ;
    }

    private stringToPartno(str: string) : number[] {
        let ret: number[] = [] ;
        let parts: string[] = str.split('-');

        if (parts.length === 2) {
            let robot: number = parseInt(parts[0], 10) ;
            if ((typeof robot) === "number") {
                let partno: number = parseInt(parts[1], 10) ;
                if ((typeof partno) === "number") {
                    ret.push(robot) ;
                    ret.push(partno) ;
                }
            }
        }

        return ret;
    }

    private partToLoose(part: RobotPart) : LooseObject {
        let ret: LooseObject = {} ;
        let title: string = this.partnoString(part.robot_, part.part_);
        let icon: string ;

        let ntype: string = "" ;

        if (part.type_ === RobotService.partTypeAssembly) {
            icon = '/nologin/images/empty.png' ;
            ntype = 'Assembly' ;
        }
        else if (part.type_ === RobotService.partTypeCOTS) {
            icon = '/nologin/images/file.png' ;
            ntype = 'COTS' ;
        }
        else if (part.type_ === RobotService.partTypeManufactured) {
            icon = '/nologin/images/file.png' ;
            ntype = 'Manufactured' ;
        }
        else {
            icon = '/nologin/images/file.png' ;
            ntype = '?';
        }

        ret['title'] = title ;
        ret['key'] = this.partnoString(part.robot_, part.part_) ;
        ret['icon'] = icon ;
        ret['ntype'] = ntype ;
        ret['desc'] = part.description_ ;
        ret['creator'] = part.username_ ;
        ret['modified'] = part.modified_ ;

        if (part.type_ === RobotService.partTypeAssembly) {
            ret['folder'] = true ;
        }

        return ret;
    }
    
    private findPartById(id: number, parts: RobotPart[]) : RobotPart | null {
        for(let part of parts) {
            if (part.part_ === id)
                return part ;
        }

        return null ;
    }

    private appendChild(parent: LooseObject, child: LooseObject) {
        if (parent['children'] === undefined) {
            parent['children'] = [] ;
            parent['icon'] = '/nologin/images/empty.png' ;
        }
        parent['children'].push(child);
    }

    private addChildren(obj: LooseObject, parent: number, parts: RobotPart[]) {
        for(let part of parts) {
            if (part.parent_ === parent) {
                let child: LooseObject = this.partToLoose(part);
                this.appendChild(obj, child);
                if (part.type_ === RobotService.partTypeAssembly) {
                    this.addChildren(child, part.part_, parts);
                }
            }
        }
    }

    private partsToTree(id: number, parts: RobotPart[]) : LooseObject[] {
        let ret: LooseObject[] = [] ;

        let toppart: RobotPart | null = this.findPartById(id, parts);
        if (toppart !== null) {
            let top: LooseObject = this.partToLoose(toppart);
            ret.push(top);
            this.addChildren(top, id, parts);
        }

        return ret ;
    }

    private async newrobot(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        //
        // Create a new top level robot subsystem for the parts database, 
        // Body: name, desc
        //
        let robotno: number = this.nextkey_++ ;

        //
        // First create a new part
        //
        let attribs: Map<string, string> = new Map<string, string>() ;
        await this.createNewPart(-robotno, robotno, 1, RobotService.partTypeAssembly, req.body.desc, u.username_, attribs);

        let current = this.now() ;

        let sql = 'INSERT INTO robots VALUES (' ;
        sql += String(robotno) + ',';
        sql += '"' + req.body.name + '",' ;
        sql += '"' + req.body.desc + '",' ;
        sql += '"' + u.username_ + '",' ;
        sql += '"' + current + '",' ;
        sql += '"' + current + '",' ;
        sql += String(1) + ");"

        await this.db_.exec(sql, (err) => {
            if (err) {
                xeroDBLoggerLog('ERROR', 'RobotService: failed to add robot "' + req.body.name + '" to the database - ' + err) ;
                xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"') ;
            }
            else {
                this.nextkey_++ ;
                xeroDBLoggerLog('INFO', 'UserService: added robot "' + req.body.name + '" to the database');

                let r: Robot = new Robot(robotno, req.body.name, req.body.desc, 1, u!.username_, current, current);
                this.robots_.set(robotno, r);
                this.users_.notify('robot-added', 'A new robot "' + req.body.name + '" was added by user "' + u.username_ + '"');

                this.nextpart_.set(robotno, 2);
            }
        }) ;        

        res.redirect('/menu') ;
    }

    private async listall(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>)  {
        let ret = [] ;
        for(let [key, robot] of this.robots_) {
            let nrobot: LooseObject = {} ;
            nrobot['name'] = robot.name_;
            nrobot['description'] = robot.description_ ;
            nrobot['creator'] = robot.creator_ ;
            nrobot['created'] = robot.created_ ;
            nrobot['part'] = this.partnoString(robot.id_, robot.topid_);
            ret.push(nrobot);            
        }

        res.json(ret);
    }

    private async viewpart(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>)  {

        if (req.query.partno === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/viewpart'));
            return ;
        }

        let partno: number[] = this.stringToPartno(req.query.partno) ;
        if (partno.length !== 2) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/viewpart'));
            return ;
        }

        xeroDBLoggerLog('DEBUG', 'viewpart request, robot ' + String(partno[0]) + ", part " + String(partno[1])) ;
        let vars:Map<string, string> = new Map<string, string>() ;
        vars.set('$$$PARTNO$$$', req.query.partno);
        res.send(processPage(vars, '/normal/viewpart.html'));
    }

    private async partdata(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {        
        let result: LooseObject = {} ;

        if (req.query.partno === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/viewpart'));
            return ;
        }

        let partno: number[] = this.stringToPartno(req.query.partno) ;
        if (partno.length !== 2) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/viewpart'));
            return ;
        }

        if (partno.length !== 2) {
            res.send(createMessageHtml('ERROR', 'invalid part number for REST API request'));
            return ;
        }

        this.getPartsForRobot(partno[0])
            .then((partobjs) => {
                let result = this.partsToTree(partno[1], partobjs) ;
                res.json(result) ;
            })
            .catch((err) => {

            }) ;
    }

    private async newpart(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.query.parent === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/newpart'));
            return ;
        }

        if (req.query.parent === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/newpart'));
            return ;
        }

        if (req.query.type === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/newpart'));
            return ;
        }

        let nums: number[] = this.stringToPartno(req.query.parent) ;
        if (nums.length !== 2) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/newpart'));
            return ;
        }

        if (req.query.type !== 'A' && req.query.type != 'C' && req.query.type != 'M') {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/newpart'));
            return ;
        }

        let parent: number = nums[1] ;
        let robot: number = nums[0] ;
        let type: string = req.query.type ;

        let attribs: Map<string, string> = new Map<string, string>() ;
        let newpartno: number = this.nextpart_.get(robot)!
        this.nextpart_.set(robot, newpartno + 1) ;
        await this.createNewPart(parent, robot, newpartno, type, 'New Robot Part', u.username_, attribs);

        let url: string = '/robots/viewpart?partno=' + this.partnoString(robot, 1) ;
        res.redirect(url) ;
    }


    private async editpart(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.query.partno === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/viewpart'));
            return ;
        }

        let partno: number[] = this.stringToPartno(req.query.partno) ;
        if (partno.length !== 2) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/viewpart'));
            return ;
        }

        if (partno.length !== 2) {
            res.send(createMessageHtml('ERROR', 'invalid part number for REST API request'));
            return ;
        }

        let vars:Map<string, string> = new Map<string, string>() ;
        vars.set('$$$PARTNO$$$', req.query.partno);
        res.send(processPage(vars, '/normal/editpart.html'));
    }

    public get(req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        xeroDBLoggerLog('DEBUG',"RobotService: rest api '" + req.path + "'");

        console.log(this.now());

        let u: User | null = this.users_.userFromRequest(req);
        if (u === null) {
            xeroDBLoggerLog('ERROR',"RobotService: rest api '" + req.path + "' with invalid user");
            res.send(createMessageHtml('Error', 'invalid user for request')) ;
            return ;
        }

        let handled: boolean = false ;

        if (req.path === '/robots/listall') {
            this.listall(u, req, res);
            handled = true ;
        }
        else if (req.path === '/robots/viewpart') {
            this.viewpart(u, req, res) ;
            handled = true ;
        }
        else if (req.path === '/robots/partdata') {
            this.partdata(u, req, res);
            handled = true ;
        }
        else if (req.path === '/robots/newpart') {
            this.newpart(u, req, res);
            handled = true ;
        }
        else if (req.path === '/robots/editpart') {
            this.editpart(u, req, res);
            handled = true ;
        }

        if (u.isAdmin()) {
            if (req.path === '/robots/newrobot') {
                this.newrobot(u, req, res) ;
                handled = true ;
            }
        }

        if (!handled) {
            let msg: string = 'unknown robots REST API request "' + req.path + "'" ;
            res.status(404).send(createMessageHtml('Unknown Request', msg));
        }
    }
}
