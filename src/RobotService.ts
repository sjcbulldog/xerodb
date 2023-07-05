import sqlite3 from 'sqlite3';
import { Response, Request } from 'express';
import path from 'path';
import { Robot, RobotPart } from "./Robot";
import { createMessageHtml, processPage } from './pagegen';
import { UserService } from './UserService';
import { User } from './User';
import { xeroDBLoggerLog } from './logger';
import { PartAttr } from './PartAttr';
import { DatabaseService } from './DatabaseService';
import { AuditService } from './AuditService';
import { NextState, PartState } from './PartState';

//
// Part numbers
//   RRRR PPPPPP
//   Robot Number - three digits (0-9)
//   Part Number - six digits (0-9)
//

interface LooseObject {
    [key: string]: any
};

export class RobotService extends DatabaseService {
    private static readonly robotFileName: string = 'robot.db';
    private static readonly lettersString: string = 'abcdefghijklmnopqrstuvwxzyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    private static readonly numbersString: string = '0123456789';
    private static readonly partTypeCOTS: string = 'C';
    private static readonly partTypeAssembly: string = 'A';
    private static readonly partTypeManufactured: string = 'M';

    private static readonly stateNew: string = "new" ;
    private static readonly stateDone: string = "Done" ;

    private static readonly robotNumberLength: number = 3;
    private static readonly partNumberLength: number = 4;

    private static readonly methodStudent = "student" ;
    private static readonly methodMentor = "mentor" ;
    private static readonly methodAnyone = "anyone" ;
    private static readonly methodAssignedStudent = "assigned-student" ;
    private static readonly methodAssignedMentor = "assigned-mentor" ;

    private static readonly manufacturing_types_ = [
        "3d Mark Forge Print",
        "3d Stratus Print",
        "Velox C & C Router",
        "Omio",
        "Misc",
    ] ;

    private static readonly COTSAttributes = [
        new PartAttr('Vendor Name', PartAttr.TypeStringName, true, ''),
        new PartAttr('Vendor Site', PartAttr.TypeStringName, true, ''),
        new PartAttr('Vendor Part Number', PartAttr.TypeStringName, false, ''),
        new PartAttr('Cost', PartAttr.TypeDoubleName, false, '0.0'),
    ];

    private static readonly COTSStates = [
        // States: new, requested, ordered, complete
        new PartState(RobotService.stateNew, 
            [
                new NextState('requested', RobotService.methodAssignedStudent)
            ]),
        new PartState('requested',
            [
                new NextState('ordered', RobotService.methodMentor),
                new NextState(RobotService.stateDone, RobotService.methodMentor)
            ]),
        new PartState('ordered',
            [
                new NextState(RobotService.stateDone, RobotService.methodAnyone)
            ]),
        new PartState(RobotService.stateDone,
            [
                new NextState('new', RobotService.methodMentor),
                new NextState('ordered', RobotService.methodMentor),
                new NextState('requested', RobotService.methodMentor)
            ]),
    ] ;

    private static readonly AssemblyAttributes = [
    ];

    private static readonly AssemblyStates = [
        // States: new, requested, ordered, complete
        new PartState(RobotService.stateNew, 
            [
                new NextState('requested', RobotService.methodAssignedStudent)
            ]),
        new PartState('requested',
            [
                new NextState('ordered', RobotService.methodMentor),
                new NextState(RobotService.stateDone, RobotService.methodMentor)
            ]),
        new PartState('ordered',
            [
                new NextState(RobotService.stateDone, RobotService.methodAnyone)
            ]),
        new PartState(RobotService.stateDone,
            [
                new NextState('new', RobotService.methodMentor),
                new NextState('ordered', RobotService.methodMentor),
                new NextState('requested', RobotService.methodMentor)
            ]),
    ] ;

    private static readonly ManufacturedAttributes = [
        new PartAttr('Method', PartAttr.TypeManufacturingType, false, ''),
        new PartAttr('Cost', PartAttr.TypeDoubleName, false, '0.0'),
    ];

    private static readonly ManufacturedStates = [
        // States: new, requested, ordered, complete
        new PartState(RobotService.stateNew, 
            [
                new NextState('requested', RobotService.methodAssignedStudent)
            ]),
        new PartState('requested',
            [
                new NextState('ordered', RobotService.methodMentor),
                new NextState(RobotService.stateDone, RobotService.methodMentor)
            ]),
        new PartState('ordered',
            [
                new NextState(RobotService.stateDone, RobotService.methodAnyone)
            ]),
        new PartState(RobotService.stateDone,
            [
                new NextState('new', RobotService.methodMentor),
                new NextState('ordered', RobotService.methodMentor),
                new NextState('requested', RobotService.methodMentor)
            ]),
    ] ;    



    nextkey_: number;
    robots_: Map<number, Robot>;
    nextpart_: Map<number, number>;
    users_: UserService;
    audit_: AuditService;

    constructor(rootdir: string, users: UserService, audit: AuditService) {
        super('RobotService', path.join(rootdir, RobotService.robotFileName));

        this.users_ = users;
        this.audit_ = audit ;
        this.nextkey_ = 1;
        this.robots_ = new Map<number, Robot>();
        this.nextpart_ = new Map<number, number>();

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
            parent int not null,
            robotid int not null,
            partno int not null,
            state text not null,
            student text not null,
            mentor text not null,
            quantity int not null,
            desc text not null,
            type text not null,
            username text not null,
            created text not null,
            modified text not null, 
            attribs text);
        ` ;

        this.db().exec(sql, (err) => {
            if (err) {
                let msg: string = this.name() + ": cannot create table 'parts' in RobotService" ;
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
                let r: Robot = new Robot(id, name as string, desc as string, part as number, username as string, created as string, modified as string);
                this.robots_.set(id, r);

                if (this.nextkey_ < id + 1) {
                    this.nextkey_ = id + 1;
                }
            })
        });
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

    private async updatePart(u: User, part: RobotPart, prev: RobotPart): Promise<void> {
        let sql: string = 'UPDATE parts SET';
        sql += " desc='" + part.description_ + "',";
        sql += " quantity=" + String(part.quantity_) + ",";
        sql += " student='" + this.escapeString(part.student_) + "',"
        sql += " mentor='" + this.escapeString(part.mentor_) + "',"
        sql += " state='" + part.state_ + "'," ;
        sql += " attribs='" + this.escapeString(this.attribMapToString(part.attribs_)) + "'";
        sql += ' WHERE robotid=' + String(part.robot_);
        sql += ' AND partno=' + String(part.part_);

        let ret: Promise<void> = new Promise<void>((resolve, reject) => {
            try {
                this.db().exec(sql, (err) => {
                    if (err) {
                        xeroDBLoggerLog('ERROR', 'RobotService: failed update to part "' + this.partnoString(part.robot_, part.part_) + '" - ' + err);
                        xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
                        reject(err);
                    }
                    else {
                        let diffs: string[] = this.diffRobotPart(part, prev) ;
                        for(let diff of diffs) {
                            this.audit_.parts(u.username_, u.ipaddr_, this.partnoString(part.robot_, part.part_), part.description_, diff);
                        }
                        this.updateRobotModified(part.robot_);
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

    private async createNewPart(u: User, parent: number, robot: number, partno: number, state: string, type: string, desc: string, attribs: Map<string, string>): Promise<void> {

        let sql = 'INSERT INTO parts VALUES (';
        sql += String(parent) + ",";
        sql += String(robot) + ",";
        sql += String(partno) + ",";
        sql += "'" + state + "'," ;
        sql += "''," ;                      // student
        sql += "''," ;                      // mentor
        sql += String(1) + ",";
        sql += "'" + this.escapeString(desc) + "',";
        sql += "'" + type + "',";
        sql += "'" + u.username_ + "',";
        sql += "'" + this.now() + "',";
        sql += "'" + this.now() + "',";
        sql += "'" + this.escapeString(this.attribMapToString(attribs)) + "')";

        let ret: Promise<void> = new Promise<void>((resolve, reject) => {
            try {
                this.db().exec(sql, (err) => {
                    if (err) {
                        xeroDBLoggerLog('ERROR', 'RobotService: failed to add part "' + this.partnoString(robot, partno) + '" to the database - ' + err);
                        xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
                        reject(err);
                    }
                    else {
                        xeroDBLoggerLog('INFO', 'UserService: added part "' + this.partnoString(robot, partno) + '" to the database');
                        this.updateRobotModified(robot);
                        this.audit_.parts(u.username_, u.ipaddr_, this.partnoString(robot, partno), desc, 'created new robot part, type="' + type + '"');
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

    private extractPartFromRow(robot: number, row: unknown): RobotPart {
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
        const attribsKey = 'attribs' as ObjectKey;

        let parent = (obj[parentKey] as unknown) as number;
        let partno = (obj[partnoKey] as unknown) as number;
        let state = (obj[stateKey] as unknown) as string ;
        let student = (obj[studentKey] as unknown) as string ;
        let mentor = (obj[mentorKey] as unknown) as string ;
        let quantity = (obj[quantityKey] as unknown) as number;
        let desc = (obj[descKey] as unknown) as string;
        let type = (obj[typeKey] as unknown) as string;
        let username = (obj[usernameKey] as unknown) as string;
        let created = (obj[createdKey] as unknown) as string;
        let modified = (obj[modifiedKey] as unknown) as string;
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
            state = RobotService.stateNew ;
        }

        let retval: RobotPart = new RobotPart(parent, robot, partno, state, quantity, desc, type, username, created, modified, attrlist);
        retval.student_ = student ;
        retval.mentor_ = mentor ;
        this.applyAttributes(retval);

        return retval;
    }

    private async getOnePart(robot: number, partno: number): Promise<RobotPart> {
        let ret: Promise<RobotPart> = new Promise<RobotPart>((resolve, reject) => {
            let retval: RobotPart;
            let sql = 'select parent, partno, state, student, mentor, quantity, desc, type, username, created, modified, attribs from parts where robotid=' + String(robot) + ' AND partno=' + String(partno);
            this.db().all(sql, async (err, rows) => {
                if (rows.length === 0) {
                    reject(new Error('no such record found'));
                }
                for (let row of rows) {
                    retval = this.extractPartFromRow(robot, row);
                    break;
                }
                resolve(retval);
            });
        });

        return ret;
    }

    private async getPartsForRobot(robot: number): Promise<RobotPart[]> {
        let ret: Promise<RobotPart[]> = new Promise<RobotPart[]>((resolve, reject) => {
            let retval: RobotPart[] = [];
            let sql = 'select parent, partno, state, student, mentor, quantity, desc, type, username, created, modified, attribs from parts where robotid=' + String(robot) + ';';
            this.db().all(sql, async (err, rows) => {
                if (err) {
                    resolve([]);
                }
                else {
                    let maxpart: number = 0;
                    for (let row of rows) {
                        let partobj: RobotPart = this.extractPartFromRow(robot, row);
                        if (partobj !== null) {
                            if (partobj.part_ > maxpart) {
                                maxpart = partobj.part_;
                            }
                            retval.push(partobj);
                        }
                    }

                    maxpart++;
                    this.nextpart_.set(robot, maxpart);
                    resolve(retval);
                }
            });
        });
        return ret;
    }

    private partnoString(robot: number, part: number): string {
        let rstr: string = String(robot);
        while (rstr.length < RobotService.robotNumberLength) {
            rstr = '0' + rstr;
        }

        let pstr: string = String(part);
        while (pstr.length < RobotService.partNumberLength) {
            pstr = '0' + pstr;
        }

        return rstr + '-' + pstr;
    }

    private stringToPartno(str: string): number[] {
        let ret: number[] = [];
        let parts: string[] = str.split('-');

        if (parts.length === 2) {
            let robot: number = parseInt(parts[0], 10);
            if ((typeof robot) === "number") {
                let partno: number = parseInt(parts[1], 10);
                if ((typeof partno) === "number") {
                    ret.push(robot);
                    ret.push(partno);
                }
            }
        }

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
                            if (u.isRole('mentor')) {
                                valid = true ;
                            }
                            break;

                        case RobotService.methodStudent:
                            if (u.isRole('student')) {
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

    private partToLoose(u:User | null, part: RobotPart): LooseObject {
        let ret: LooseObject = {};
        let title: string = this.partnoString(part.robot_, part.part_);
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
        ret['key'] = this.partnoString(part.robot_, part.part_);
        ret['icon'] = icon;
        ret['ntype'] = ntype;
        ret['desc'] = part.description_;
        ret['creator'] = part.username_;
        ret['modified'] = part.modified_;
        ret['quantity'] = part.quantity_;
        ret['student'] = part.student_ ;
        ret['mentor'] = part.mentor_ ;
        ret['state'] = part.state_ ;

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

    private findPartById(id: number, parts: RobotPart[]): RobotPart | null {
        for (let part of parts) {
            if (part.part_ === id)
                return part;
        }

        return null;
    }

    private appendChild(parent: LooseObject, child: LooseObject) {
        if (parent['children'] === undefined) {
            parent['children'] = [];
            parent['icon'] = '/nologin/images/empty.png';
        }
        parent['children'].push(child);
    }

    private addChildren(obj: LooseObject, parent: number, parts: RobotPart[], depth: number) {
        for (let part of parts) {
            if (part.parent_ === parent) {
                let child: LooseObject = this.partToLoose(null, part);
                this.appendChild(obj, child);
                if (part.type_ === RobotService.partTypeAssembly && depth < 100) {
                    this.addChildren(child, part.part_, parts, depth + 1);
                }
            }
        }
    }

    private partsToTree(id: number, parts: RobotPart[]): LooseObject[] {
        let ret: LooseObject[] = [];

        let toppart: RobotPart | null = this.findPartById(id, parts);
        if (toppart !== null) {
            let top: LooseObject = this.partToLoose(null, toppart);
            ret.push(top);
            this.addChildren(top, id, parts, 1);
        }

        return ret;
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
        await this.createNewPart(u, -robotno, robotno, 1, RobotService.stateNew, RobotService.partTypeAssembly, desc, attribs);

        let current = this.now();

        let sql = 'INSERT INTO robots VALUES (';
        sql += String(robotno) + ',';
        sql += '"' + req.body.name + '",';
        sql += '"' + req.body.desc + '",';
        sql += '"' + u.username_ + '",';
        sql += '"' + current + '",';
        sql += '"' + current + '",';
        sql += String(1) + ");"

        await this.db().exec(sql, (err) => {
            if (err) {
                xeroDBLoggerLog('ERROR', 'RobotService: failed to add robot "' + req.body.name + '" to the database - ' + err);
                xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
            }
            else {
                this.nextkey_++;
                xeroDBLoggerLog('INFO', 'UserService: added robot "' + req.body.name + '" to the database');

                let r: Robot = new Robot(robotno, req.body.name, req.body.desc, 1, u!.username_, current, current);
                this.robots_.set(robotno, r);
                this.users_.notify('robot-added', 'A new robot "' + req.body.name + '" was added by user "' + u.username_ + '"');

                this.nextpart_.set(robotno, 2);

                this.audit_.parts(u.username_, u.ipaddr_, this.partnoString(robotno, 0), desc, "created new robot '" + req.body.name + "', robot number " + robotno);
            }
        });

        res.redirect('/normal/robots.html');
    }

    private async listall(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        let ret = [];
        for (let [key, robot] of this.robots_) {
            let nrobot: LooseObject = {};
            nrobot['name'] = robot.name_;
            nrobot['description'] = robot.description_;
            nrobot['creator'] = robot.creator_;
            nrobot['created'] = robot.created_;
            nrobot['part'] = this.partnoString(robot.id_, robot.topid_);
            ret.push(nrobot);
        }

        res.json(ret);
    }

    private async viewpart(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {

        if (req.query.partno === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/viewpart'));
            return;
        }

        let partno: number[] = this.stringToPartno(req.query.partno);
        if (partno.length !== 2) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/viewpart'));
            return;
        }

        xeroDBLoggerLog('DEBUG', 'viewpart request, robot ' + String(partno[0]) + ", part " + String(partno[1]));
        let vars: Map<string, string> = new Map<string, string>();
        vars.set('$$$PARTNO$$$', req.query.partno);
        res.send(processPage(vars, '/normal/viewpart.html'));
    }

    private async partdata(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        let result: LooseObject = {};

        if (req.query.partno === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/viewpart'));
            return;
        }

        let partno: number[] = this.stringToPartno(req.query.partno);
        if (partno.length !== 2) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/viewpart'));
            return;
        }

        if (partno.length !== 2) {
            res.send(createMessageHtml('ERROR', 'invalid part number for REST API request'));
            return;
        }

        this.getPartsForRobot(partno[0])
            .then((partobjs) => {
                let result: LooseObject[];

                try {
                    result = this.partsToTree(partno[1], partobjs);
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
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/newpart'));
            return;
        }

        if (req.query.parent === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/newpart'));
            return;
        }

        if (req.query.type === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/newpart'));
            return;
        }

        let nums: number[] = this.stringToPartno(req.query.parent);
        if (nums.length !== 2) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/newpart'));
            return;
        }

        if (req.query.type !== 'A' && req.query.type != 'C' && req.query.type != 'M') {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/newpart'));
            return;
        }

        let parent: number = nums[1];
        let robot: number = nums[0];
        let type: string = req.query.type;

        let attribs: Map<string, string> = new Map<string, string>();
        let newpartno: number = this.nextpart_.get(robot)!
        this.nextpart_.set(robot, newpartno + 1);
        await this.createNewPart(u, parent, robot, newpartno, RobotService.stateNew, type, 'Double Click To Edit', attribs);

        let url: string = '/robots/viewpart?partno=' + this.partnoString(robot, 1);
        res.redirect(url);
    }

    private async editpart(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.query.partno === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/viewpart'));
            return;
        }

        let partno: number[] = this.stringToPartno(req.query.partno);
        if (partno.length !== 2) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/viewpart'));
            return;
        }

        if (partno.length !== 2) {
            res.send(createMessageHtml('ERROR', 'invalid part number for REST API request'));
            return;
        }

        let vars: Map<string, string> = new Map<string, string>();
        vars.set('$$$PARTNO$$$', req.query.partno);
        res.send(processPage(vars, '/normal/editpart.html'));
    }

    private async editpartdone(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.body.partno === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/editpartdone'));
            return;
        }

        let partno: number[] = this.stringToPartno(req.body.partno);
        if (partno.length !== 2) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/editpartdone'));
            return;
        }

        let part: RobotPart = await this.getOnePart(partno[0], partno[1]);
        if (part === null) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/editpartdone'));
            return;
        }

        let oldpart: RobotPart = part.clone() ;

        let olddesc: string = part.description_ ;

        if (req.body.mentor)
            part.mentor_ = req.body.mentor ;

        if (req.body.student)
            part.student_ = req.body.student ;

        if (req.body.state)
            part.state_ = req.body.state ;

        part.description_ = req.body.desc;
        part.quantity_ = parseInt(req.body.quantity, 10);

        for (let attr of this.getAttributes(part)) {
            let val = req.body[attr.name_];
            if (val) {
                part.attribs_.set(attr.name_, val);
            }
        }

        this.updatePart(u, part, oldpart);

        if (olddesc !== part.description_) {
            this.audit_.updatePartDesc(req.body.partno, part.description_);
        }

        let url: string = '/robots/viewpart?partno=' + this.partnoString(part.robot_, 1);
        res.redirect(url);
    }

    private async deletepart(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.query.partno === undefined) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/delete'));
            return;
        }

        let partno: number[] = this.stringToPartno(req.query.partno);
        if (partno.length !== 2) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/delete'));
            return;
        }

        let sql: string = 'UPDATE parts SET ';
        sql += 'parent = "0"';
        sql += ' WHERE robotid=' + String(partno[0]);
        sql += ' AND partno=' + String(partno[1]);
        this.db().exec(sql, (err) => {
            if (err) {
                xeroDBLoggerLog('ERROR', 'RobotService: failed to update part (delete)time - ' + err.message);
                xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
            }
        });

        let url: string = '/robots/viewpart?partno=' + this.partnoString(partno[0], 1);
        res.redirect(url);
    }

    private async reparentpart(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {

        if (req.query.partno === undefined) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/reparentpart'));
            return;
        }

        let partno: number[] = this.stringToPartno(req.query.partno);
        if (partno.length !== 2) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/reparentpart'));
            return;
        }

        if (req.query.parent === undefined) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/reparentpart'));
            return;
        }

        let parentno: number[] = this.stringToPartno(req.query.parent);
        if (parentno.length !== 2) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/reparentpart'));
            return;
        }

        let sql: string = 'UPDATE parts SET ';
        sql += 'parent = ' + String(parentno[1]);
        sql += ' WHERE robotid=' + String(partno[0]);
        sql += ' AND partno=' + String(partno[1]);
        this.db().exec(sql, (err) => {
            if (err) {
                xeroDBLoggerLog('ERROR', 'RobotService: failed to update part (delete)time - ' + err.message);
                xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
            }
        });

        let url: string = '/robots/viewpart?partno=' + this.partnoString(partno[0], 1);
        res.redirect(url);
    }

    private async copypart(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {

        if (req.query.partno === undefined) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/reparentpart'));
            return;
        }

        let partno: number[] = this.stringToPartno(req.query.partno);
        if (partno.length !== 2) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/reparentpart'));
            return;
        }

        if (req.query.parent === undefined) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/reparentpart'));
            return;
        }

        let parentno: number[] = this.stringToPartno(req.query.parent);
        if (parentno.length !== 2) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/reparentpart'));
            return;
        }

        let newpartno: number = this.nextpart_.get(partno[0])!
        this.nextpart_.set(partno[0], newpartno + 1);
        let part: RobotPart = await this.getOnePart(partno[0], partno[1]);
        await this.createNewPart(u, parentno[1], partno[0], newpartno, RobotService.stateNew, part.type_, part.description_, part.attribs_);

        let url: string = '/robots/viewpart?partno=' + this.partnoString(partno[0], 1);
        res.redirect(url);
    }    

    private async partinfo(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.query.partno === undefined) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/reparentpart'));
            return;
        }

        let partno: number[] = this.stringToPartno(req.query.partno);
        if (partno.length !== 2) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/reparentpart'));
            return;
        }

        let part: RobotPart = await this.getOnePart(partno[0], partno[1]);
        let ret: LooseObject = this.partToLoose(u, part);
        res.json(ret);
    }

    private async alldescs(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {

        if (req.query.partno === undefined) {
            res.send(createMessageHtml('Error', 'invalid api REST request /robots/viewpart'));
            return;
        }

        let partno: number[] = this.stringToPartno(req.query.partno);
        if (partno.length !== 2) {
            res.send(createMessageHtml('Error', 'invalid ROBOT api REST request /robots/viewpart'));
            return;
        }

        let parts: RobotPart[] = await this.getPartsForRobot(partno[0]);
        let ret : string[] = [] ;

        for(let part of parts) {
            ret.push(part.description_)
        }
        
        res.json(ret);
    }

    private async manufacturingtypes(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        res.json(RobotService.manufacturing_types_);
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
        else if (req.path === '/robots/viewpart') {
            this.viewpart(u, req, res);
            handled = true;
        }
        else if (req.path === '/robots/partdata') {
            this.partdata(u, req, res);
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
