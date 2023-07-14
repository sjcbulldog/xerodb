import sqlite3 from 'sqlite3';
import { Response, Request } from 'express';
import path from 'path';
import { Robot } from "./Robot";
import { RobotPart } from "./RobotPart";
import { PartNumber } from "./PartNumber" ;
import { createMessageHtml, processPage } from './pagegen';
import { UserService } from './UserService';
import { User } from './User';
import { xeroDBLoggerLog } from './logger';
import { PartAttr } from './PartAttr';
import { DatabaseService } from './DatabaseService';
import { AuditService } from './AuditService';
import { NextState, PartState } from './PartState';
import { sendEmail } from './mail';
import { packFiles, packLinks, unpackFiles, unpackLinks } from './dbutils';
import { FileStorageManager } from './FileStorageManager';

interface LooseObject {
    [key: string]: any
};

export class RobotService extends DatabaseService {
    private static readonly robotFileName: string = 'robot.db';
    private static readonly partTypeCOTS: string = 'C';
    private static readonly partTypeAssembly: string = 'A';
    private static readonly partTypeManufactured: string = 'M';

    private static readonly stateUnassigned: string = "Unassigned" ;
    private static readonly stateAssigned: string = "Assigned" ;
    private static readonly stateReadyToOrder: string = "Ready To Order" ;
    private static readonly stateOrdered: string = "Ordered" ;
    private static readonly stateWaitingForParts: string = "Waiting For Parts" ;
    private static readonly stateReadyForAssembly: string = "Ready For Assembly" ;
    private static readonly stateInAssembly: string = "In Assembly" ;
    private static readonly stateReadyForMentorCheck: string = "Ready For Mentor Check"
    private static readonly stateReadyForCAD: string = "Ready For CAD" ;
    private static readonly stateInCAD: string = "In CAD" ;
    private static readonly stateReadyForDrawingCheck: string = "Ready For Drawing Check" ;
    private static readonly stateReadyForCAM: string = "Ready For CAM" ;
    private static readonly stateInCAM: string = "In CAM" ;
    private static readonly stateReadyForBuild: string = "Ready For Build" ;
    private static readonly stateInBuild: string = "In Build" ;
    private static readonly stateReadyForBuildCheck: string = "Ready For Build Check" ;    
    private static readonly stateDone: string = "Done" ;

    private static readonly methodAssignStudentAndMentor = "assign-to" ;
    private static readonly methodStudent = "student" ;
    private static readonly methodMentor = "mentor" ;
    private static readonly methodAnyone = "anyone" ;
    private static readonly methodAssignedStudent = "assigned-student" ;
    private static readonly methodAssignedMentor = "assigned-mentor" ;

    private static readonly unitCostAttribute = 'Unit Cost' ;

    private static readonly doubleClickMessage = 'Double Click To Edit' ;

    private static readonly manufacturing_types_ = [
        "By Hand",
        "Manual Mill",
        "Lathe",
        "Omio",
        "Velox",
        "CNC Mill",
        "EZTrak",
        "Glowforge",
        "3D Print"
    ] ;

    private static readonly material_types_ = [
        "Polycarbonate",
        "Aluminum",
        "Delrin",
        "PLA",
        "ABS",
        "Onyx"
    ]

    private static readonly COTSAttributes = [
        new PartAttr('Vendor Name', PartAttr.TypeStringName, true, ''),
        new PartAttr('Vendor Site', PartAttr.TypeStringName, true, ''),
        new PartAttr('Vendor Part Number', PartAttr.TypeStringName, false, ''),
        new PartAttr(RobotService.unitCostAttribute, PartAttr.TypeCurrencyName, false, '0.0'),
    ];

    private static readonly COTSStates = [
        new PartState(RobotService.stateUnassigned, 
            [
                // System will transition when both student and mentor are assigned
            ]),
        new PartState(RobotService.stateAssigned, 
            [
                new NextState(RobotService.stateReadyToOrder, RobotService.methodStudent),
            ]),
        new PartState(RobotService.stateReadyToOrder,
            [
                new NextState(RobotService.stateOrdered, RobotService.methodMentor),
                new NextState(RobotService.stateDone, RobotService.methodMentor)
            ]),
        new PartState(RobotService.stateOrdered,
            [
                new NextState(RobotService.stateDone, RobotService.methodAnyone),
                new NextState(RobotService.stateAssigned, RobotService.methodMentor),
                new NextState(RobotService.stateReadyToOrder, RobotService.methodMentor)
            ]),
        new PartState(RobotService.stateDone,
            [
                new NextState(RobotService.stateAssigned, RobotService.methodMentor),
                new NextState(RobotService.stateOrdered, RobotService.methodMentor),
                new NextState(RobotService.stateReadyToOrder, RobotService.methodMentor)
            ]),
    ] ;

    private static readonly AssemblyAttributes = [
    ];

    private static readonly AssemblyStates = [
        new PartState(RobotService.stateUnassigned, 
            [
                // System will transition when both student and mentor are assigned                
            ]),
        new PartState(RobotService.stateAssigned,
            [
                new NextState(RobotService.stateWaitingForParts, RobotService.methodStudent),
            ]),
        new PartState(RobotService.stateWaitingForParts,
            [
                // System will transition to ReadyForAssembly when all child parts are 'Done'
            ]),
        new PartState(RobotService.stateReadyForAssembly,
            [
                new NextState(RobotService.stateInAssembly, RobotService.methodStudent),
            ]),
        new PartState(RobotService.stateInAssembly,
            [
                new NextState(RobotService.stateReadyForMentorCheck, RobotService.methodStudent),
            ]),
        new PartState(RobotService.stateReadyForMentorCheck,
            [
                new NextState(RobotService.stateWaitingForParts, RobotService.methodMentor),
                new NextState(RobotService.stateReadyForAssembly, RobotService.methodMentor),
                new NextState(RobotService.stateInAssembly, RobotService.methodAnyone),
                new NextState(RobotService.stateDone, RobotService.methodMentor),
            ]),
        new PartState(RobotService.stateDone,
            [
                new NextState(RobotService.stateWaitingForParts, RobotService.methodMentor),
                new NextState(RobotService.stateReadyForAssembly, RobotService.methodMentor),
                new NextState(RobotService.stateInAssembly, RobotService.methodMentor),
            ]),
    ] ;

    private static readonly ManufacturedAttributes = [
        new PartAttr('Machine', PartAttr.TypeChoiceName, true, '').setChoices(RobotService.manufacturing_types_),
        new PartAttr('Material', PartAttr.TypeChoiceName, true, '').setChoices(RobotService.material_types_),
        new PartAttr('Dimension', PartAttr.TypeDoubleName, true, ''),
        new PartAttr(RobotService.unitCostAttribute, PartAttr.TypeCurrencyName, false, '0.0')
    ];

    private static readonly ManufacturedStates = [
        // States: new, requested, ordered, complete
        new PartState(RobotService.stateUnassigned, 
            [
            ]),
        new PartState(RobotService.stateAssigned,
            [
                new NextState(RobotService.stateReadyForCAD, RobotService.methodStudent),
            ]),          
        new PartState(RobotService.stateReadyForCAD,
            [
                new NextState(RobotService.stateInCAD, RobotService.methodAnyone),
            ]),      
        new PartState(RobotService.stateInCAD,
            [
                new NextState(RobotService.stateReadyForDrawingCheck, RobotService.methodAnyone),
                new NextState(RobotService.stateReadyForCAD, RobotService.methodAnyone),
            ]),
        new PartState(RobotService.stateReadyForDrawingCheck,
            [
                new NextState(RobotService.stateReadyForCAM, RobotService.methodMentor),
                new NextState(RobotService.stateReadyForBuild, RobotService.methodMentor),
                new NextState(RobotService.stateInCAD, RobotService.methodAnyone),
            ]),
        new PartState(RobotService.stateReadyForCAM,
            [
                new NextState(RobotService.stateInCAM, RobotService.methodAnyone),
            ]),
        new PartState(RobotService.stateInCAM,
            [
                new NextState(RobotService.stateReadyForCAM, RobotService.methodAnyone),
                new NextState(RobotService.stateReadyForBuild, RobotService.methodAnyone),
            ]),
        new PartState(RobotService.stateReadyForBuild,
            [
                new NextState(RobotService.stateInBuild, RobotService.methodAnyone),
                new NextState(RobotService.stateInCAD, RobotService.methodAnyone),
                new NextState(RobotService.stateInCAM, RobotService.methodAnyone),
            ]),
        new PartState(RobotService.stateInBuild,
            [
                new NextState(RobotService.stateReadyForBuildCheck, RobotService.methodAnyone),
            ]),
        new PartState(RobotService.stateReadyForBuildCheck,
            [
                new NextState(RobotService.stateDone, RobotService.methodMentor),
            ]),
    ] ;    

    nextkey_: number;
    robots_: Map<number, Robot>;
    users_: UserService;
    audit_: AuditService;
    fsmgr_ : FileStorageManager;

    constructor(rootdir: string, users: UserService, audit: AuditService) {
        super('RobotService', path.join(rootdir, RobotService.robotFileName));

        this.users_ = users;
        this.audit_ = audit ;
        this.nextkey_ = 1;
        this.robots_ = new Map<number, Robot>();
        this.fsmgr_ = new FileStorageManager(path.join(rootdir, 'files'));

        this.loadAll() ;
    }

    protected createTables() {
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
            this.db().exec(sql, (err) => {
                if (err) {
                    let msg: string = this.name() + ": cannot create table 'robots' in RobotService" ;
                    xeroDBLoggerLog('ERROR', msg);
                    throw new Error(msg)
                }
            });

        sql =
            `CREATE TABLE parts (
                parent text,
                partno text not null,
                state text not null,
                student text not null,
                mentor text not null,
                quantity int not null,
                desc text not null,
                type text not null,
                username text not null,
                created text not null,
                modified text not null, 
                files text not null,
                links text not null,
                donedate text not null,
                nextdate text not null,
                attribs text);
        ` ;

        this.db().exec(sql, (err) => {
            if (err) {
                let msg: string = this.name() + ": cannot create table 'parts' in RobotService" ;
                xeroDBLoggerLog('ERROR', msg);
                throw new Error(msg)
            }
        });

        sql =
            `CREATE TABLE notification (
                username text not null,
                robot int not null) ;
            ` ;
            this.db().exec(sql, (err) => {
                if (err) {
                    let msg: string = this.name() + ": cannot create table 'notification' in RobotService" ;
                    xeroDBLoggerLog('ERROR', msg);
                    throw new Error(msg)
                }
            }); 
            
        sql =
            `CREATE TABLE drawings (
                partno text not null,
                filename text not null,
                localfile text not null,
                desc text not null);
            ` ;
            this.db().exec(sql, (err) => {
                if (err) {
                    let msg: string = this.name() + ": cannot create table 'drawings' in RobotService" ;
                    xeroDBLoggerLog('ERROR', msg);
                    throw new Error(msg)
                }
            });    
    }

    private loadAll() {
        let sql =
            `
            select id, name, desc, username, created, modified, part from robots;
            `;
        this.db().all(sql, (err, rows) => {
            for(let row of rows) {
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
                let part = (obj[partKey] as unknown) as string ;

                let partnos: PartNumber[] = [] ;
                let parts: string[] = part.split(',');
                for(let one of parts) {
                    let oneno: PartNumber | null = PartNumber.fromString(one) ;
                    if (oneno === null)
                        continue ;

                    partnos.push(oneno);
                }

                let r: Robot = new Robot(id, name as string, desc as string, partnos, username as string, created as string, modified as string);
                this.robots_.set(id, r);

                if (this.nextkey_ < id + 1) {
                    this.nextkey_ = id + 1;
                }
            }
        }) ;
    }

    private storeFile(partno: string, name: string, desc: string, data:Buffer) : string {
        let fname: string = this.fsmgr_.storeFile(data);

        let sql = 'INSERT INTO drawings VALUES (';
            sql += "'" + partno + "',";
            sql += "'" + name + "',";
            sql += "'" + fname + "',";
            sql += "'" + desc + "');";

            this.db().exec(sql, (err) => {
                if (err) {
                }
                else {
                }
            });
        
        return fname ;
    }

    private diffAttribs(current: Map<string, string>, old: Map<string, string>) : string[] {
        let ret: string[] = [] ;

        for(let key of old.keys()) {
            if (!current.has(key)) {
                ret.push('attribute "' + key + '" removed, old value = "' + old.get(key) + '"');
            }
        }

        for(let key of current.keys()) {
            if (!old.has(key)) {
                ret.push('attribute "' + key + '" added, value = "' + current.get(key) + '"');
            }
        }        

        let changed: string[] = [] ;
        for(let key of current.keys()) {
            if (old.has(key)) {
                if (current.get(key) !== old.get(key)) {
                    ret.push('attribute "' + key + '" changed, "' + old.get(key) + '"->"' + current.get(key) + '"');
                }
            }
        }         

        return ret;
    }

    private diffRobotPart(current: RobotPart, old: RobotPart) : string[] {
        let ret: string[] = [];

        if (current.parent_ !== old.parent_) {
            ret.push('parent: ' + old.parent_ + '->' + current.parent_);
        }

        if (current.state_ !== old.state_) {
            ret.push('state: "' + old.state_ + '"->"' + current.state_ + '"');
        }

        if (current.student_ !== old.student_) {
            ret.push('student: "' + old.student_ + '"->"' + current.student_ + '"');
        }

        if (current.mentor_ !== old.mentor_) {
            ret.push('mentor: "' + old.mentor_ + '"->"' + current.mentor_ + '"');
        }

        if (current.quantity_ !== old.quantity_) {
            ret.push('quantity: ' + old.quantity_ + '->' + current.quantity_);
        } 

        if (current.description_ !== old.description_) {
            ret.push('description: "' + old.description_ + '"->"' + current.description_ + '"');
        }     

        ret.push.apply(this.diffAttribs(current.attribs_, old.attribs_));

        return ret ;
    }


    private getPartAttrDescFromSet(descs: PartAttr[], key: string): PartAttr | null {
        for (let desc of descs) {
            if (desc.name_ === key)
                return desc;
        }

        return null;
    }

    private getPartAttrDesc(descs: PartAttr[], key: string): LooseObject {
        let ret: LooseObject = {};
        let desc: PartAttr | null = this.getPartAttrDescFromSet(descs, key);
        if (desc !== null) {
            ret['name'] = desc.name_;
            ret['required'] = desc.required_;
            ret['type'] = desc.type_;
            ret['choices'] = desc.choices_ ;
        }

        return ret;
    }

    private attribMapToArray(attribs: Map<string, string>, descs: PartAttr[]) {
        let ret: LooseObject[] = [];
        for (let [key, value] of attribs) {
            let lobj: LooseObject = {};
            lobj['key'] = key;
            lobj['value'] = value;
            lobj['desc'] = this.getPartAttrDesc(descs, key);
            ret.push(lobj);
        }

        return ret;
    }

    private attribMapToString(attribs: Map<string, string>) {
        let str: string = "";
        for (let [key, value] of attribs) {
            if (str.length > 0) {
                str += ",";
            }
            str += "'";
            str += key;
            str += "'";
            str += '=';
            str += "'";
            str += this.escapeString(value);
            str += "'";
        }
        return str;
    }

    private stringToAttribMap(attribs: string) {
        let ret: Map<string, string> = new Map<string, string>();
        let index: number = 0;
        let ch: string;

        while (index < attribs.length) {
            //
            // Parse the key, all letters, numbers, and underscore
            //
            let key: string = "";

            //
            // Get and skip the leading quote in the key
            //
            ch = attribs.charAt(index);
            if (ch != "'")
                break;
            index++;

            while (index < attribs.length && attribs.charAt(index) !== "'") {
                let ch = attribs.charAt(index);
                key += ch;
                index++;
            }

            //
            // If we are not at the end of the string, skip the trailing
            // quote in the key
            //
            if (index === attribs.length)
                break;
            index++;

            if (index === attribs.length) {
                break;
            }

            //
            // Check for an skip the equals sign between the key and the value
            //
            if (attribs.charAt(index) !== '=') {
                break;
            }
            index++;

            //
            // Get and skip the leading quote in the value
            //
            if (attribs.charAt(index) !== "'") {
                break;
            }
            index++;

            let value: string = "";
            while (index < attribs.length) {
                let ch = attribs.charAt(index);
                if (ch === "'") {
                    if (index < attribs.length - 1 && attribs.charAt(index + 1) === "'") {
                        value += "'";
                        index += 2;
                    }
                    else {
                        break;
                    }
                }
                else {
                    value += ch;
                    index++;
                }
            }

            ret.set(key, value);

            if (index === attribs.length)
                break;

            // Skip the trailing quote of the value
            index++;

            if (index === attribs.length)
                break;

            //
            // Skip the comma separating the name value pairs in the string
            //
            ch = attribs.charAt(index);
            if (ch != ',')
                break;
            index++;
        }

        return ret;
    }

    private async updateRobotModified(robot: number) {
        let sql: string = 'UPDATE robots SET';
        sql += " modified = '" + this.now() + "'";
        sql += " WHERE key=" + String(robot);
        this.db().exec(sql, (err) => {
            if (err) {
                xeroDBLoggerLog('ERROR', 'RobotService: failed to update robot modified time, robot = "' + String(robot) + '" - ' + err);
                xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
            }
        });
    }

    private async isNotify(u: string, robot: number) : Promise<boolean> {
        let ret: Promise<boolean> = new Promise<boolean>(async (resolve, reject) => {
            let sql = 'select username, robot from notification where robot=' + String(robot) ;
            await this.db().all(sql, async (err, rows) => {
                if (!err) {
                    for (let row of rows) {
                        let obj: Object = row as Object;
                        type ObjectKey = keyof typeof obj;
                        const usernameKey = 'username' as ObjectKey;
                        const robotKey = 'robot' as ObjectKey;
                
                        let username = (obj[usernameKey] as unknown) as string;
                        if (username === u)
                            resolve(true) ;
                    }
                }
                resolve(false);
            });          
        }) ;
        return ret;
    }

    private tellUpdate(username: string, ipaddr: string, partno: PartNumber, desc: string, action: string) {
        this.audit_.parts(username, ipaddr, partno, desc, action);

        let msg : string = 'The user "' + username + '" modified part "' + partno + '" - ' + action ;
        let sql = 'select username, robot from notification where robot=' + partno.robot_ ;
        this.db().all(sql, async (err, rows) => {
            if (!err) {
                for (let row of rows) {

                    let obj: Object = row as Object;
                    type ObjectKey = keyof typeof obj;
                    const usernameKey = 'username' as ObjectKey;
                    const robotKey = 'robot' as ObjectKey;
            
                    let username = (obj[usernameKey] as unknown) as string;

                    let email: string | null = this.users_.getEmailFromUser(username);
                    if (email !== null) {
                        sendEmail(email, 'XeroDB robot changed', msg);
                    }
                }
            }
        });        
    }

    private async updatePartNumbers(u: User, part: RobotPart, newnum: PartNumber, newparent: PartNumber): Promise<void> {
        let sql: string = 'UPDATE parts SET';
        sql += " partno='" + newnum.toString() + "',";
        sql += " parent='" + newparent.toString() + "'" ;
        sql += " WHERE partno='" + part.part_.toString() + "'" ;

        let ret: Promise<void> = new Promise<void>((resolve, reject) => {
            try {
                let oldnum: PartNumber = part.part_ ;
                this.db().exec(sql, (err) => {
                    if (err) {
                        xeroDBLoggerLog('ERROR', 'RobotService: failed update to part number "' + part.part_.toString() + '" - ' + err);
                        xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
                        reject(err);
                    }
                    else {
                        part.part_ = newnum ;
                        let action: string = 'updated part number to ' + newnum.toString();
                        this.tellUpdate(u.username_, u.ipaddr_, oldnum, part.description_, action);
                        this.updateRobotModified(part.part_.robot_);
                        resolve();
                    }
                });
            }
            catch (err) {
                xeroDBLoggerLog('ERROR', 'createNewPart - sql threw exception');
            }
        });

        return ret;
    }

    private async updatePart(u: User, part: RobotPart, prev: RobotPart): Promise<void> {
        if (part.state_ == RobotService.stateUnassigned && part.student_.length > 0 && part.mentor_.length > 0) {
            part.state_ = RobotService.stateAssigned ;
        }

        let sql: string = 'UPDATE parts SET';
        sql += " desc='" + part.description_ + "',";
        sql += " quantity=" + String(part.quantity_) + ",";
        sql += " student='" + this.escapeString(part.student_) + "',"
        sql += " mentor='" + this.escapeString(part.mentor_) + "',"
        sql += " state='" + part.state_ + "'," ;
        sql += " donedate='" + part.donedate_ + "'," ;
        sql += " nextdate='" + part.nextdate_ + "'," ;
        sql += " files='" + this.escapeString(packFiles(part.files_)) + "'," ;
        sql += " links='" + this.escapeString(packLinks(part.links_)) + "'," ;
        sql += " attribs='" + this.escapeString(this.attribMapToString(part.attribs_)) + "'";
        sql += " WHERE partno='" + part.part_.toString() + "'" ;

        let ret: Promise<void> = new Promise<void>((resolve, reject) => {
            try {
                this.db().exec(sql, (err) => {
                    if (err) {
                        xeroDBLoggerLog('ERROR', 'RobotService: failed update to part "' + part.part_.toString() + '" - ' + err);
                        xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
                        reject(err);
                    }
                    else {
                        let diffs: string[] = this.diffRobotPart(part, prev) ;
                        for(let diff of diffs) {
                            this.tellUpdate(u.username_, u.ipaddr_, part.part_, part.description_, diff);
                        }
                        this.updateRobotModified(part.part_.robot_);
                        resolve();
                    }
                });
            }
            catch (err) {
                xeroDBLoggerLog('ERROR', 'createNewPart - sql threw exception');
            }
        });

        return ret;
    }

    private async createNewPart(u: User, parent: PartNumber | null, partno: PartNumber, state: string, type: string, desc: string, 
                                    attribs: Map<string, string>, student: string, mentor: string): Promise<void> {
        let sql = 'INSERT INTO parts VALUES (';
        if (parent === null) {
            sql += "null," ;
        }
        else {
            sql += "'" + parent.toString() + "',";
        }
        sql += "'" + partno.toString() + "',";
        sql += "'" + state + "'," ;
        sql += "'" + student + "'," ;
        sql += "'" + mentor + "'," ;
        sql += String(1) + ",";
        sql += "'" + this.escapeString(desc) + "',";
        sql += "'" + type + "',";
        sql += "'" + u.username_ + "',";
        sql += "'" + this.now() + "',";
        sql += "'" + this.now() + "',";
        sql += "'',";
        sql += "'',";
        sql += "'',";
        sql += "'',";
        sql += "'" + this.escapeString(this.attribMapToString(attribs)) + "')";

        let ret: Promise<void> = new Promise<void>(async (resolve, reject) => {
            try {
                await this.db().exec(sql, (err) => {
                    if (err) {
                        xeroDBLoggerLog('ERROR', 'RobotService: failed to add part "' + partno.toString() + '" to the database - ' + err);
                        xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
                        reject(err);
                    }
                    else {
                        xeroDBLoggerLog('INFO', 'UserService: added part "' + partno.toString() + '" to the database');
                        this.updateRobotModified(partno.robot_);
                        this.tellUpdate(u.username_, u.ipaddr_, partno, desc, 'created new robot part, type="' + type + '"');
                        resolve();
                    }
                });
            }
            catch (err) {
                xeroDBLoggerLog('ERROR', 'createNewPart - sql threw exception');
            }
        });

        return ret;
    }

    private getAttributes(part: RobotPart): PartAttr[] {
        let ret: PartAttr[] = [];

        if (part.type_ === RobotService.partTypeAssembly) {
            ret = RobotService.AssemblyAttributes;
        }
        else if (part.type_ === RobotService.partTypeCOTS) {
            ret = RobotService.COTSAttributes;
        }
        else if (part.type_ === RobotService.partTypeManufactured) {
            ret = RobotService.ManufacturedAttributes;
        }

        return ret;
    }

    private getStates(part: RobotPart): PartState[] {
        let ret: PartState[] = [];

        if (part.type_ === RobotService.partTypeAssembly) {
            ret = RobotService.AssemblyStates;
        }
        else if (part.type_ === RobotService.partTypeCOTS) {
            ret = RobotService.COTSStates;
        }
        else if (part.type_ === RobotService.partTypeManufactured) {
            ret = RobotService.ManufacturedStates;
        }

        return ret;
    }

    private applyAttributes(part: RobotPart) {
        let attribs: PartAttr[] = this.getAttributes(part);

        for (let attr of attribs) {
            if (!part.attribs_.has(attr.name_)) {
                //
                // The part is missing the attribute, add a default value
                //
                part.attribs_.set(attr.name_, attr.default_);
            }
        }
    }

    private async getNextPartNumber(temp: PartNumber) : Promise<PartNumber> {
        let ret: Promise<PartNumber> = new Promise<PartNumber>((resolve, reject) => {
            let str: string = temp.toString() ;
            let len: number = str.lastIndexOf('-');
            let comp: string = str.substring(0, len);
            let sql = "SELECT partno from parts WHERE substring(partno, 1, " + String(len) + ") = '" + comp + "'" ;

            this.db().all(sql, (err, rows) => {
                if (err) {
                    reject(err) ;
                }
                else if (rows.length === 0) {
                    //
                    // There are not parts that match, the number is 1
                    //
                    resolve(new PartNumber(temp.robot_, temp.abbrev_, 1));
                }
                else
                {
                    let max = 1 ;
                    for(let row of rows) {
                        let obj: Object = row as Object;
                        type ObjectKey = keyof typeof obj;
                        const partnoKey = 'partno' as ObjectKey;
                        let partno = (obj[partnoKey] as unknown) as string;

                        let ptemp: PartNumber | null = PartNumber.fromString(partno) ;
                        if (ptemp === null)
                            continue ;

                        if (ptemp.part_ > max) {
                            max = ptemp.part_ ;
                        }
                    }
                    resolve(new PartNumber(temp.robot_, temp.abbrev_, max + 1));
                }
            });
        }) ;

        return ret ;
    }

    private extractPartFromRow(row: unknown): RobotPart | null {
        let obj: Object = row as Object;
        type ObjectKey = keyof typeof obj;
        const parentKey = 'parent' as ObjectKey;
        const partnoKey = 'partno' as ObjectKey;
        const stateKey = 'state' as ObjectKey ;
        const studentKey = 'student' as ObjectKey ;
        const mentorKey = 'mentor' as ObjectKey ;
        const quantityKey = 'quantity' as ObjectKey;
        const descKey = 'desc' as ObjectKey;
        const typeKey = 'type' as ObjectKey;
        const usernameKey = 'username' as ObjectKey;
        const createdKey = 'created' as ObjectKey;
        const modifiedKey = 'modified' as ObjectKey;
        const filesKey = 'files' as ObjectKey ;
        const linksKey = 'links' as ObjectKey ;
        const donedateKey = 'donedate' as ObjectKey ;
        const nextdateKey = 'nextdate' as ObjectKey ;
        const attribsKey = 'attribs' as ObjectKey;

        let parent = (obj[parentKey] as unknown) as string;
        let partno = (obj[partnoKey] as unknown) as string;
        let state = (obj[stateKey] as unknown) as string ;
        let student = (obj[studentKey] as unknown) as string ;
        let mentor = (obj[mentorKey] as unknown) as string ;
        let quantity = (obj[quantityKey] as unknown) as number;
        let desc = (obj[descKey] as unknown) as string;
        let type = (obj[typeKey] as unknown) as string;
        let username = (obj[usernameKey] as unknown) as string;
        let created = (obj[createdKey] as unknown) as string;
        let modified = (obj[modifiedKey] as unknown) as string;
        let files = (obj[filesKey] as unknown) as string;
        let links = (obj[linksKey] as unknown) as string;
        let donedate = (obj[donedateKey] as unknown) as string;
        let nextdate = (obj[nextdateKey] as unknown) as string;
        let attribs = (obj[attribsKey] as unknown) as string;

        let attrlist: Map<string, string>;
        if (attribs === undefined) {
            attrlist = new Map<string, string>();
        } else {
            attrlist = this.stringToAttribMap(attribs);
        }

        if (state === 'undefined') {
            //
            // A fail safe for bugs to given an out
            //
            state = RobotService.stateUnassigned ;
        }

        let parentNum: PartNumber | null = null ;
        if (parent !== null) {            
            parentNum = PartNumber.fromString(parent) ;
            if (parentNum === null)
                return null ;
        }

        let partNum: PartNumber | null = PartNumber.fromString(partno) ;

        if (partNum === null)
            return null ;

        let filelist : string [] = unpackFiles(files) ;
        let linklist : string [] = unpackLinks(links) ;
        let retval: RobotPart = new RobotPart(parentNum!, partNum!, state, quantity, desc, type, username, created, 
                                    modified, mentor, student, filelist, linklist, donedate, nextdate, attrlist);
        this.applyAttributes(retval);

        return retval;
    }

    private async getOnePart(partno: PartNumber): Promise<RobotPart | null> {
        let ret: Promise<RobotPart | null > = new Promise<RobotPart | null>((resolve, reject) => {
            let retval: RobotPart | null;
            let sql = "select parent, partno, state, student, mentor, quantity, desc, type, username, created, modified, files, links, donedate, nextdate, attribs from parts where partno='" + partno + "'" ;
            this.db().all(sql, async (err, rows) => {
                if (rows.length === 0) {
                    reject(new Error('no such record found'));
                }
                for (let row of rows) {
                    retval = this.extractPartFromRow(row);
                    break;
                }
                resolve(retval);
            });
        });

        return ret;
    }

    public async getPartsForRobot(robot: number): Promise<RobotPart[]> {
        let ret: Promise<RobotPart[]> = new Promise<RobotPart[]>((resolve, reject) => {
            let retval: RobotPart[] = [];
            let rstr = PartNumber.robotNumberToString(robot) + '-' ;
            let where = " where substring(partno,1," + rstr.length + ")='" + rstr + "'" ;
            let sql = "select parent, partno, state, student, mentor, quantity, desc, type, username, created, modified, files, links, donedate, nextdate, attribs from parts" + where ;
            this.db().all(sql, async (err, rows) => {
                if (err) {
                    resolve([]);
                }
                else {
                    for (let row of rows) {
                        let partobj: RobotPart | null = this.extractPartFromRow(row);
                        if (partobj !== null) {
                            retval.push(partobj);
                        }
                    }
                    resolve(retval);
                }
            });
        });
        return ret;
    }

    private findState(part: RobotPart, states : PartState[]) : PartState | null {
        for(let state of states) {
            if (state.name_ === part.state_)
                return state ;
        }

        return null ;
    }

    private nextStates(u: User, part: RobotPart) : string[] {
        let ret: string[] = [] ;
        let state: PartState | null = this.findState(part, this.getStates(part)) ;

        if (state !== null) {
            for(let next of state.next_) {
                let valid: boolean = false ;

                if (u.isAdmin()) {
                    valid = true ;
                }
                else {
                    switch(next.method_) {
                        case RobotService.methodAnyone:
                            valid = true ;
                            break; 

                        case RobotService.methodAssignedMentor:
                            if ((part.mentor_.length === 0 && u.isRole('mentor')) || (part.mentor_ === u.username_))
                            {
                                valid = true ;
                            }
                            break; 

                        case RobotService.methodAssignedStudent:
                            if (part.student_.length === 0 || part.student_ === u.username_)
                            {
                                valid = true ;
                            }
                            break ;

                        case RobotService.methodMentor:
                            if (u.isRole(UserService.roleMentor)) {
                                valid = true ;
                            }
                            break;

                        case RobotService.methodStudent:
                            if (u.isRole(UserService.roleStudent)) {
                                valid = true ;
                            }
                            break ;
                    }
                }

                if (valid) {
                    ret.push(next.next_);
                }
            }
        }

        return ret;
    }

    public partToLoose(u:User | null, part: RobotPart): LooseObject {
        let ret: LooseObject = {};
        let title: string = part.part_.toString();
        let icon: string;

        let ntype: string = "";

        if (part.type_ === RobotService.partTypeAssembly) {
            icon = '/nologin/images/empty.png';
            ntype = 'Assembly';
        }
        else if (part.type_ === RobotService.partTypeCOTS) {
            icon = '/nologin/images/file.png';
            ntype = 'COTS';
        }
        else if (part.type_ === RobotService.partTypeManufactured) {
            icon = '/nologin/images/file.png';
            ntype = 'Manufactured';
        }
        else {
            icon = '/nologin/images/file.png';
            ntype = '?';
        }

        ret['title'] = title;
        ret['key'] = part.part_.toString();
        ret['icon'] = icon;
        ret['ntype'] = ntype;
        ret['desc'] = part.description_;
        ret['creator'] = part.username_;
        ret['modified'] = part.modified_;
        ret['quantity'] = part.quantity_;
        ret['student'] = part.student_ ;
        ret['mentor'] = part.mentor_ ;
        ret['state'] = part.state_ ;
        if (part.nextdate_.length === 0) {
            ret['nextdate'] = 'Not Set' ;
        }
        else {
            ret['nextdate'] = part.nextdate_ ;
        }

        if (part.donedate_.length === 0) {
            ret['donedate'] = 'Not Set' ;
        }
        else {
            ret['donedate'] = part.donedate_ ;
        }

        if (u === null) {
            ret['admin'] = false ;
            ret['nextstates'] = [] ;
        }
        else {
            ret['admin'] = u.isAdmin() ;
            ret['nextstates'] = this.nextStates(u, part);
        }
        ret['attribs'] = this.attribMapToArray(part.attribs_, this.getAttributes(part));

        if (part.type_ === RobotService.partTypeAssembly) {
            ret['folder'] = true;
        }

        return ret;
    }

    private findPartById(partno: PartNumber, parts: RobotPart[]): RobotPart | null {
        for (let part of parts) {
            if (part.part_.toString() === partno.toString())
                return part;
        }

        return null;
    }

    private appendChild(pobj: LooseObject, child: LooseObject) {
        if (pobj['children'] === undefined) {
            pobj['children'] = [];
            pobj['icon'] = '/nologin/images/empty.png';
        }
        pobj['children'].push(child);
    }

    private addChildren(obj: LooseObject, parent: PartNumber, parts: RobotPart[], depth: number) {
        for (let part of parts) {
            if (part.isChildOf(parent)) {
                let child: LooseObject = this.partToLoose(null, part);
                this.appendChild(obj, child);
                if (part.type_ === RobotService.partTypeAssembly && depth < 100) {
                    this.addChildren(child, part.part_, parts, depth + 1);
                }
            }
        }
    }

    private partsToTree(tops: PartNumber[], parts: RobotPart[]): LooseObject[] {
        let ret: LooseObject[] = [];

        for(let top of tops) {
            let toppart: RobotPart | null = this.findPartById(top, parts);
            if (toppart !== null) {
                let topobj: LooseObject = this.partToLoose(null, toppart);
                ret.push(topobj);
                this.addChildren(topobj, top, parts, 1);
            }
        }

        return ret;
    }

    private copyAttributes(attribs: Map<string, string>) : Map<string, string> {
        let ret : Map<string, string> = new Map<string, string>() ;

        for(let [key, value] of attribs) {
            ret.set(key, value) ;
        }

        return ret ;
    }

    private async copyOnePart(u: User, part: RobotPart, parent: PartNumber, keep: boolean, parts: RobotPart[]) : Promise<void> {
        let ret: Promise<void> = new Promise<void>( async (resolve, reject) => {
            //
            // So we need a new part number
            //
            let newpartno: PartNumber ;
            
            if (keep) {
                newpartno = await this.getNextPartNumber(part.part_);
            } else {
                newpartno = await this.getNextPartNumber(parent);
            }

            //
            // Make a copy of the part, with the new part number and place it under the given parent
            //
            let st: string = RobotService.stateUnassigned ;
            if (part.student_.length > 0 && part.mentor_.length > 0) {
                st = RobotService.stateAssigned ;
            }
            await this.createNewPart(u, parent, newpartno, st, part.type_, part.description_, 
                                    this.copyAttributes(part.attribs_), part.student_, part.mentor_);

            //
            // Now, if the part is an assembly, it might have children
            //
            if (part.type_ === RobotService.partTypeAssembly) {
                for(let one of parts) {
                    if (one.isChildOf(part.part_)) {
                        //
                        // This is a child of the assembly we are copying
                        //
                        await this.copyOnePart(u, one, newpartno, false, parts);
                    }
                }
            }
            resolve() ;
        });

        return ret;
    }

    private async deleteOnePart(part: RobotPart, parts: RobotPart[]) : Promise<void> {
        let ret: Promise<void> = new Promise<void>( async (resolve, reject) => {
            if (part.type_ == RobotService.partTypeAssembly) {
                for(let one of parts) {
                    if (one.isChildOf(part.part_)) {
                        //
                        // This is a child of the assembly we are deleting, delete the children
                        //
                        await this.deleteOnePart(one, parts);
                    }
                }
            }

            let sql = "DELETE from parts WHERE partno='" + part.part_.toString() + "';" ;
            this.db().exec(sql, (err) => {
                if (err) {
                    xeroDBLoggerLog('ERROR', 'RobotService: failed to update part (delete)time - ' + err.message);
                    xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
                    reject(err);
                }
                else {
                    resolve() ;
                }
            });
        }) ;
        return ret ;
    }

    private async checkAssembly(u: User, part:RobotPart, parts: RobotPart[]) : Promise<void> {
        let ret: Promise<void> = new Promise<void>( async (resolve, reject) => { 
            if (part.state_ === RobotService.stateWaitingForParts) {
                let done: boolean = true ;
                for(let one of parts) {
                    if (one.isChildOf(part.part_)) {
                        if (one.state_ !== RobotService.stateDone) {
                            if (one.type_ === RobotService.partTypeAssembly) {
                                this.checkAssembly(u, one, parts) ;
                                if (one.state_ !== RobotService.stateDone) {
                                    done = false ;
                                }
                            }
                            else {
                                done = false ;
                            }
                        }
                    }
                }

                if (done) {
                    let prev: RobotPart = part.clone() ;
                    part.state_ = RobotService.stateReadyForAssembly ;
                    await this.updatePart(u, part, prev) ;
                }
            }

            resolve() ;
        }) ;

        return ret ;
    }

    private checkStudentChange(u:User, part: RobotPart, prev: RobotPart) : boolean {
        let change: boolean = false ;
        
        if (part.type_ === RobotService.partTypeManufactured) {
            //
            // There are a set of transitions here
            //
            if (prev.state_ === RobotService.stateReadyForBuild && part.state_ === RobotService.stateInBuild) {
                part.student_ = u.username_ ;
                change = true ;
            }
            else if (prev.state_ === RobotService.stateReadyForCAD && part.state_ === RobotService.stateInCAD) {
                part.student_ = u.username_ ;
                change = true ;
            }
            else if (prev.state_ === RobotService.stateReadyForCAM && part.state_ === RobotService.stateInCAM) {
                part.student_ = u.username_ ;
                change = true ;
            }
        }
        else if (part.type_ === RobotService.partTypeAssembly) {
            if (prev.state_ === RobotService.stateReadyForAssembly && part.state_ === RobotService.stateInAssembly) {
                part.student_ = u.username_ ;
                change = true ;
            }
        }

        return change ;
    }

    private async checkStates(u: User, rid: number) {
        let robot: Robot | undefined = this.robots_.get(rid) ;
        if (robot !== undefined) {
            let parts: RobotPart[] = await this.getPartsForRobot(rid);
            for(let top of robot.topparts_) {
                let toppart: RobotPart | null = this.findPartById(top, parts) ;
                if (toppart !== null) {
                    await this.checkAssembly(u, toppart, parts);
                }
            }
        }
    }

    private async newrobot(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        //
        // Create a new top level robot subsystem for the parts database, 
        // Body: name, desc
        //
        let robotno: number = this.nextkey_++;

        //
        // First create a new part
        //
        let attribs: Map<string, string> = new Map<string, string>();
        let desc: string = 'Top Level Robot Subsystem' ;
        let comppart: PartNumber = await this.getNextPartNumber(new PartNumber(robotno, 'COMP', 0)) ;
        let pracpart: PartNumber = await this.getNextPartNumber(new PartNumber(robotno, 'PRAC', 0)) ;
        await this.createNewPart(u, null, comppart, RobotService.stateUnassigned, RobotService.partTypeAssembly, "Competition Robot Top Assembly", attribs, '', '');
        await this.createNewPart(u, null, pracpart, RobotService.stateUnassigned, RobotService.partTypeAssembly, "Practice Robot Top Assembly", attribs, '', '');

        let current = this.now();

        let topparts = comppart.toString() + "," + pracpart.toString() ;

        let sql = 'INSERT INTO robots VALUES (';
        sql += String(robotno) + ',';
        sql += "'" + req.body.name + "',";
        sql += "'" + req.body.desc + "',";
        sql += "'" + u.username_ + "',";
        sql += "'" + current + "',";
        sql += "'" + current + "',";
        sql += "'" + topparts + "');"

        await this.db().exec(sql, (err) => {
            if (err) {
                xeroDBLoggerLog('ERROR', 'RobotService: failed to add robot "' + req.body.name + '" to the database - ' + err);
                xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
            }
            else {
                this.nextkey_++;
                xeroDBLoggerLog('INFO', 'UserService: added robot "' + req.body.name + '" to the database');

                let r: Robot = new Robot(robotno, req.body.name, req.body.desc, [comppart, pracpart], u!.username_, current, current);
                this.robots_.set(robotno, r);
            }
        });

        res.redirect('/normal/robots.html');
    }

    private async listall(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        let ret = [];
        for (let [key, robot] of this.robots_) {
            let nrobot: LooseObject = {};
            nrobot['name'] = robot.name_;
            nrobot['id'] = robot.id_ ;
            nrobot['description'] = robot.description_;
            nrobot['creator'] = robot.creator_;
            nrobot['created'] = robot.created_;
            nrobot['modified'] = robot.modified_ ;
            nrobot['notify'] = await this.isNotify(u.username_, robot.id_);
            ret.push(nrobot);
        }

        res.json(ret);
    }

    private async viewrobot(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {

        if (req.query.robotid === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/viewrobot - missing required parameters'));
            return;
        }

        let rid: number = parseInt(req.query.robotid, 10) ;
        if (isNaN(rid)) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/viewrobot - invalid robot id'));
            return;            
        }

        let robot: Robot | undefined = this.robots_.get(rid);
        if (robot === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/viewrobot - invalid robot id'));
            return;            
        }

        xeroDBLoggerLog('DEBUG', 'viewrobot request, robot ' + robot.id_);
        let vars: Map<string, string> = new Map<string, string>();
        vars.set('$$$ROBOTID$$$', req.query.robotid);
        res.send(processPage(vars, '/normal/viewrobot.html'));
    }

    private async robotdata(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        let result: LooseObject = {};

        if (req.query.robotid === undefined) {
            res.json([]);
            return;
        }

        let rid: number = parseInt(req.query.robotid) ;
        if (isNaN(rid)) {
            res.json([]);
            return;     
        }

        let robot: Robot | undefined = this.robots_.get(rid) ;
        if (robot === undefined) {
            res.json([]);
            return;
        }

        this.getPartsForRobot(rid)
            .then((partobjs) => {
                try {
                    let result: LooseObject[] = this.partsToTree(robot!.topparts_, partobjs);
                    res.json(result);
                }
                catch (err) {
                    res.json([]);
                }

            })
            .catch((err) => {
            });
    }

    private async assigned(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        let result: LooseObject[] = [];

        for(let [number, robot] of this.robots_) {
            await this.getPartsForRobot(robot.id_)
                .then((partobjs) => {
                    for(let part of partobjs) {
                        if (part.student_ === u.username_ || part.mentor_ === u.username_) {
                            let loose: LooseObject = this.partToLoose(u, part) ;
                            result.push(loose) ;
                        }
                    }
                })
                .catch((err) => {
                    res.json([]);
                    return ;
                });
        }

        res.json(result) ;
    }   
    
    private async unassigned(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        let result: LooseObject[] = [];

        for(let [number, robot] of this.robots_) {
            await this.getPartsForRobot(robot.id_)
                .then((partobjs) => {
                    for(let part of partobjs) {
                        if (part.student_.length === 0 || part.mentor_.length === 0) {
                            let loose: LooseObject = this.partToLoose(u, part) ;
                            result.push(loose) ;
                        }
                    }
                })
                .catch((err) => {
                    res.json([]);
                    return ;
                });
        }

        res.json(result) ;
    }     

    private async newpart(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.query.parent === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/newpart - missing query parameters'));
            return;
        }

        if (req.query.abbrev === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/newpart - missing query parameters'));
            return;
        }

        if (req.query.type !== 'A' && req.query.type !== 'C' && req.query.type !== 'M') {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/newpart - invalid type'));
            return;
        }

        if (req.query.abbrev.length > 0 && !/[a-zA-Z]+/.test(req.query.abbrev)) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/newpart - invalid abbrev'));
            return;
        }

        let type: string = req.query.type;
        let parent: PartNumber | null = PartNumber.fromString(req.query.parent) ;
        if (parent === null) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/newpart - invalid parent'));
            return;
        }

        let attribs: Map<string, string> = new Map<string, string>();
        let abbrev = parent.abbrev_ ;
        if (req.query.abbrev && req.query.abbrev.length > 0)
            abbrev = req.query.abbrev ;
        let newpartno: PartNumber = await this.getNextPartNumber(new PartNumber(parent.robot_, abbrev, 0)) ;
        await this.createNewPart(u, parent, newpartno, RobotService.stateUnassigned, type, RobotService.doubleClickMessage, attribs, '', '') ;

        let url: string = '/robots/viewrobot?robotid=' + parent.robot_ ;
        res.redirect(url);
    }

    private async editpart(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.query.partno === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/editpart - missing query parameters'));
            return;
        }

        let partno: PartNumber | null = PartNumber.fromString(req.query.partno) ;
        if (partno === null) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/editpart - invalid part number'));
            return;
        }

        let vars: Map<string, string> = new Map<string, string>();
        vars.set('$$$PARTNO$$$', req.query.partno);
        vars.set('$$$DOUBLECLK$$$', RobotService.doubleClickMessage);
        vars.set('$$$RETPLACE$$$', req.query.retplace);
        res.send(processPage(vars, '/normal/editpart.html'));
    }

    private async editpartdone(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.body.partno === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/editpartdone - missing query parameters'));
            return;
        }

        let partno: PartNumber | null = PartNumber.fromString(req.body.partno) ;
        if (partno === null) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/editpartdone - invalid part number'));
            return;
        }

        let part: RobotPart | null = await this.getOnePart(partno);
        if (part === null) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/editpartdone - invalid part number'));
            return;
        }

        let oldpart: RobotPart = part.clone() ;

        if (req.body.mentor)
            part.mentor_ = req.body.mentor ;

        if (req.body.student)
            part.student_ = req.body.student ;

        if (req.body.state)
            part.state_ = req.body.state ;

        part.description_ = req.body.desc;
        part.quantity_ = parseInt(req.body.quantity, 10);
        part.donedate_ = req.body.donedate ;
        part.nextdate_ = req.body.nextdate;

        for (let attr of this.getAttributes(part)) {
            let val = req.body[attr.name_];
            if (val) {
                part.attribs_.set(attr.name_, val);
            }
        }

        if (u.isRole(UserService.roleStudent)) {
            this.checkStudentChange(u, part, oldpart) ;
        }
        this.updatePart(u, part, oldpart);
        this.checkStates(u, part.part_.robot_);

        let url: string = '/robots/viewrobot?robotid=' + part.part_.robot_ ;
        if (req.body.retplace !== undefined) {
            url = req.body.retplace ;
            url = url.replace("$$$ROBOTID$$$", "?robotid=" + part.part_.robot_) ;
        }

        res.redirect(url);
    }

    private async deletepart(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.query.partno === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/deletepart - missing query parameters'));
            return;
        }

        let partno: PartNumber | null = PartNumber.fromString(req.query.partno) ;
        if (partno === null) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/deletepart - invalid part number'));
            return;
        }

        let part: RobotPart | null = await this.getOnePart(partno);
        if (part === null) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/deletepart - invalid part number'));
            return;
        }

        let parts: RobotPart[] = await this.getPartsForRobot(partno.robot_);

        await this.deleteOnePart(part, parts) ;

        let url: string = '/robots/viewrobot?robotid=' + partno.robot_;
        res.redirect(url);
    }

    private async reparentpart(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        //
        // We are moving the part given by partno to have a new parent the parent given by parentno
        //

        if (req.query.partno === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/reparentpart - missing query parameters'));
            return;
        }

        let partno: PartNumber | null = PartNumber.fromString(req.query.partno) ;
        if (partno === null) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/reparentpart - invalid part number'));
            return;
        }

        let part: RobotPart | null = await this.getOnePart(partno);
        if (part === null) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/reparentpart - invalid part number'));
            return;
        }

        if (part.parent_ === null) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/reparentpart - invalid part number - cannot move top level assembly'));
            return;
        }

        if (req.query.parent === undefined) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/reparentpart - missing query parameters'));
            return;
        }

        let parentno: PartNumber | null = PartNumber.fromString(req.query.parent) ;
        if (parentno === null) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/reparentpart - invalid part number'));
            return;
        }

        let parts: RobotPart[] = await this.getPartsForRobot(partno.robot_);
        let keep: boolean = (part.part_.abbrev_ !== part.parent_.abbrev_);
        await this.copyOnePart(u, part, parentno, keep, parts) ;
        await this.deleteOnePart(part, parts);

        let url: string = '/robots/viewrobot?robotid=' + part.part_.robot_ ;
        res.redirect(url);
    }

    private async copypart(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        //
        // We are copying the part given by partno to have a new parent the parent given by parentno
        //
        if (req.query.partno === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/reparentpart - missing query parameters'));
            return;
        }

        let partno: PartNumber | null = PartNumber.fromString(req.query.partno) ;
        if (partno === null) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/reparentpart - invalid part number'));
            return;
        }

        let part: RobotPart | null = await this.getOnePart(partno);
        if (part === null) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/reparentpart - invalid part number'));
            return;
        }

        if (part.parent_ === null) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/reparentpart - invalid part number - cannot copy top level assembly'));
            return;
        }

        if (req.query.parent === undefined) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/reparentpart - missing query parameters'));
            return;
        }

        let parentno: PartNumber | null = PartNumber.fromString(req.query.parent) ;
        if (parentno === null) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/reparentpart - invalid part number'));
            return;
        }

        let parts: RobotPart[] = await this.getPartsForRobot(partno.robot_);
        let keep: boolean = (part.part_.abbrev_ !== part.parent_.abbrev_);
        await this.copyOnePart(u, part, parentno, keep, parts) ;

        let url: string = '/robots/viewrobot?robotid=' + part.part_.robot_ ;
        res.redirect(url);
    }    

    private async partinfo(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.query.partno === undefined) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/partinfo - missing query parameters'));
            return;
        }

        let partno: PartNumber | null = PartNumber.fromString(req.query.partno);
        if (partno === null) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/partinfo - invalid partno'));
            return;
        }

        let part: RobotPart | null = await this.getOnePart(partno);
        let ret: LooseObject = {} ;
        if (part !== null) {
            ret = this.partToLoose(u, part);
        }
        res.json(ret);
    }

    private async alldescs(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {

        if (req.query.partno === undefined) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/alldescs - missing query parameters'));
            return;
        }

        let partno: PartNumber | null = PartNumber.fromString(req.query.partno);
        if (partno === null) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/alldescs - invalid partno'));
            return;
        }

        let parts: RobotPart[] = await this.getPartsForRobot(partno.robot_);
        let ret : string[] = [] ;

        for(let part of parts) {
            ret.push(part.description_)
        }
        
        res.json(ret);
    }

    private async manufacturingtypes(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        res.json(RobotService.manufacturing_types_);
    }

    private getCost(part: RobotPart, parts: RobotPart[]) : number {
        let ret: number = 0 ;

        if (part.type_ === RobotService.partTypeAssembly) {
            for(let other of parts) {
                if (other.isChildOf(part.part_)) {
                    ret += this.getCost(other, parts) ;
                }
            }
        }
        else {
            let cost = part.attribs_.get(RobotService.unitCostAttribute) ;
            if (cost) {
                ret = parseFloat(cost) ;
            }
        }

        return ret * part.quantity_ ;
    }

    private async totalCost(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        let ret : LooseObject = { total: null } ;
        if (req.query.robotid === undefined) {
            res.json(ret);
            return;
        }

        let rid: number = parseInt(req.query.robotid, 10) ;
        if (isNaN(rid)) {
            res.json(ret) ;
            return;
        }

        let robot : Robot | undefined = this.robots_.get(rid) ;
        if (robot === undefined) {
            res.json(ret) ;
            return;
        }

        let parts: RobotPart[] = await this.getPartsForRobot(rid);

        for(let top of robot.topparts_) {
            let part: RobotPart | null = this.findPartById(top, parts);
            if (part !== null) {
                if (ret.total === null) {
                    ret.total = this.getCost(part, parts);
                }
                else {
                    ret.total += this.getCost(part, parts);
                }
            }
        }
        res.json(ret) ;
    }

    private async notify(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        let sql : string ;

        if (req.query.partno === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/notify - missing query parameter'));
            return;
        }

        let partno: PartNumber | null = PartNumber.fromString(req.query.partno);
        if (partno === null) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/alldescs - invalid partno'));
            return;
        }

        if (req.query.enabled === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/notify'));
            return;
        }

        if (req.query.enabled === true || req.query.enabled === 'true') {
            sql = 'INSERT into notification VALUES (' ;
            sql += "'" + this.escapeString(u.username_) + "'," ;
            sql += partno.robot_ + ")" ;

            this.db().exec(sql, (err) => {
                if (err) {
                    xeroDBLoggerLog('ERROR', 'RobotService: failed to add notification for robot ' + req.query.partno + ' - ' + err);
                    xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
                }
            });            
        }
        else {
            sql = 'DELETE from notification WHERE robot=' + partno.robot_ + ';' ;
            this.db().exec(sql, (err) => {
                if (err) {
                    xeroDBLoggerLog('ERROR', 'RobotService: failed to delete notification for robot ' + req.query.partno + ' - ' + err);
                    xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
                }
            });  
        }

        res.json({});
    }

    private async renameOne(u: User, part: RobotPart, abbrev: string, parent: PartNumber, parts: RobotPart[]) : Promise<void> {
        let ret: Promise<void> = new Promise<void>( async (resolve, reject) => {

            let oldnum: PartNumber = part.part_ ;

            // Rename the parent
            let temp: PartNumber = new PartNumber(part.part_.robot_, abbrev, 0);
            let newnum: PartNumber = await this.getNextPartNumber(temp);
            await this.updatePartNumbers(u, part, newnum, parent);

            if (part.type_ === RobotService.partTypeAssembly) {
                for(let one of parts) {
                    if (one.isChildOf(oldnum)) {
                        // This is a child of the part we are renaming
                        await this.renameOne(u, one, abbrev, newnum, parts);
                    }
                }
            }

            resolve() ;
        }) ;
        return ret ;
    }

    private async rename(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.query.partno === undefined) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/rename - missing query parameters'));
            return;
        }

        let partno: PartNumber | null = PartNumber.fromString(req.query.partno);
        if (partno === null) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/rename - invalid partno'));
            return;
        }

        if (req.query.abbrev === undefined) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/rename - missing query parameters'));
            return;
        }

        if (!/^[a-zA-Z]+$/.test(req.query.abbrev)) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/rename - invalid abbrev'));
            return;
        }

        let parts: RobotPart[] = await this.getPartsForRobot(partno.robot_);
        let part: RobotPart | null = this.findPartById(partno, parts);
        if (part === null) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/rename - invalid partno'));
            return;
        }

        if (part.parent_ === null) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/rename - invalid partno, cannot rename top level assemblies'));
            return;
        }

        await this.renameOne(u, part, req.query.abbrev, part.parent_, parts);

        let url: string = '/robots/viewrobot?robotid=' + part.part_.robot_ ;
        res.redirect(url);
    }

    private async adddrawing(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        let lobj : LooseObject = req as LooseObject ;
        let fname: string = this.storeFile(req.body.partno, lobj.files.drawing.name, req.body.desc, lobj.files.drawing.data);
        console.log(req);
        res.json({});
    }

    public get(req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        xeroDBLoggerLog('DEBUG', "RobotService: rest api '" + req.path + "'");

        let u: User | null = this.users_.userFromRequest(req);
        if (u === null) {
            xeroDBLoggerLog('ERROR', "RobotService: rest api '" + req.path + "' with invalid user");
            res.send(createMessageHtml('Error', 'invalid user for request'));
            return;
        }

        let handled: boolean = false;

        if (req.path === '/robots/listall') {
            this.listall(u, req, res);
            handled = true;
        }
        else if (req.path === '/robots/viewrobot') {
            this.viewrobot(u, req, res);
            handled = true;
        }
        else if (req.path === '/robots/robotdata') {
            this.robotdata(u, req, res);
            handled = true;
        }
        else if (req.path === '/robots/assigned') {
            this.assigned(u, req, res);
            handled = true;
        }
        else if (req.path === '/robots/unassigned') {
            this.unassigned(u, req, res);
            handled = true;
        }
        else if (req.path === '/robots/newpart') {
            this.newpart(u, req, res);
            handled = true;
        }
        else if (req.path === '/robots/editpart') {
            this.editpart(u, req, res);
            handled = true;
        }
        else if (req.path === '/robots/editpartdone') {
            this.editpartdone(u, req, res);
            handled = true;
        }
        else if (req.path === '/robots/deletepart') {
            this.deletepart(u, req, res);
            handled = true;
        }
        else if (req.path === '/robots/reparentpart') {
            this.reparentpart(u, req, res);
            handled = true;
        }
        else if (req.path === '/robots/copypart') {
            this.copypart(u, req, res);
            handled = true;
        }
        else if (req.path === '/robots/partinfo') {
            this.partinfo(u, req, res);
            handled = true;
        }
        else if (req.path === '/robots/alldescs') {
            this.alldescs(u, req, res);
            handled = true;
        }
        else if (req.path === '/robots/mantypes') {
            this.manufacturingtypes(u, req, res);
            handled = true;
        }
        else if (req.path === '/robots/totalcost') {
            this.totalCost(u, req, res);
            handled = true ;
        }
        else if (req.path === '/robots/notify') {
            this.notify(u, req, res);
            handled = true ;
        }
        else if (req.path === '/robots/rename') {
            this.rename(u, req, res);
            handled = true ;
        }
        else if (req.path === '/robots/adddrawing') {
            this.adddrawing(u, req, res);
            handled = true ;
        }

        if (u.isAdmin()) {
            if (req.path === '/robots/newrobot') {
                this.newrobot(u, req, res);
                handled = true;
            }
        }

        if (!handled) {
            let msg: string = 'unknown robots REST API request "' + req.path + "'";
            res.status(404).send(createMessageHtml('Unknown Request', msg));
        }
    }
}
