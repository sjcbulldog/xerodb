import sqlite3 from 'sqlite3' ;
import { Response, Request } from 'express' ;
import path from 'path';
import { Robot } from "./Robot";
import { createMessageHtml } from './pagegen';
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

    constructor(users: UserService, rootdir: string) {
        this.users_ = users ;
        this.nextkey_ = 1 ;
        this.robots_ = new Map<number, Robot>() ;
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
            id int primary key not null,
            robotid int not null,
            partno int not null,
            parent int not null,
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

    private robotByName(name: string) {
        for(let [key, robot] of this.robots_) {
            if (robot.name_ === name)
                return robot ;
        }

        return null ;
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
        return d.toISOString();
    }

    private createNewPart(robot: number, part: number, parent: number, type: string, desc: string, user: string, attribs: Map<string, string>) : Error | number {
        let ret: Error | number = -1 ;

        this.assertAttribsValid(attribs);

        let sql = 'INSERT INTO parts VALUES (' ;
        sql += String(this.nextkey_) + ',';
        sql += String(robot) + "," ;
        sql += String(part) + "," ;
        sql += String(parent) + ","
        sql += '"' + desc + '",' ;
        sql += '"' + type + '",' ;
        sql += '"' + user + '",' ;
        sql += '"' + this.now() + '",' ;
        sql += '"' + this.now() + '",' ;
        sql += "'" + this.attribMapToString(attribs) + "');" ;

        this.db_.exec(sql, (err) => {
            if (err) {
                xeroDBLoggerLog('ERROR', 'RobotService: failed to add part "' + part + '" to the database - ' + err) ;
                xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"') ;
                ret = err;
            }
            else {
                this.nextkey_++ ;
                xeroDBLoggerLog('INFO', 'UserService: added part "' + part + '" to the database');
            }
        }) ;

        return ret;
    }

    private newrobot(req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        //
        // Get the user creating the robot
        //
        let u: User | null = this.users_.userFromRequest(req);
        if (u === null) {
            res.send(createMessageHtml('Error', 'invalid user for request')) ;
            return ;
        }

        //
        // Create a new top level robot subsystem for the parts database, 
        // Body: name, desc
        //
        let robotno: number = this.nextkey_++ ;

        //
        // First create a new part
        //
        let attribs: Map<string, string> = new Map<string, string>() ;
        let topid = this.createNewPart(robotno, 1, 1, RobotService.partTypeAssembly, req.body.desc, u.username_, attribs);

        let tstr : string = typeof topid ;
        if (tstr === "Error") {
            let err: Error = topid as Error ;
            res.send(createMessageHtml('Error', 'Error creating robot top level subsystem - ' + err.message));
        }
        else 
        {
            let current = this.now() ;

            let sql = 'INSERT INTO robots VALUES (' ;
            sql += String(robotno) + ',';
            sql += '"' + req.body.name + '",' ;
            sql += '"' + req.body.desc + '",' ;
            sql += '"' + u.username_ + '",' ;
            sql += '"' + current + '",' ;
            sql += '"' + current + '",' ;
            sql += String(1) + ");"

            this.db_.exec(sql, (err) => {
                if (err) {
                    xeroDBLoggerLog('ERROR', 'RobotService: failed to add robot "' + req.body.name + '" to the database - ' + err) ;
                    xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"') ;
                }
                else {
                    this.nextkey_++ ;
                    xeroDBLoggerLog('INFO', 'UserService: added robot "' + req.body.name + '" to the database');

                    let r: Robot = new Robot(robotno, req.body.name, req.body.desc, topid as number, u!.username_, current, current);
                }
            }) ;        

            res.redirect('/menu') ;
        }
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

    private listall(req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>)  {
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

    public get(req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        xeroDBLoggerLog('DEBUG',"UserService: rest api '" + req.path + "'");
        let handled: boolean = false ;

        if (req.path === '/robots/newrobot') {
            this.newrobot(req, res) ;
            handled = true ;
        }
        else if (req.path === '/robots/listall') {
            this.listall(req, res);
            handled = true ;
        }

        if (!handled) {
            let msg: string = 'unknown robots REST API request "' + req.path + "'" ;
            res.status(404).send(createMessageHtml('Unknown Request', msg));
        }
    }
}
