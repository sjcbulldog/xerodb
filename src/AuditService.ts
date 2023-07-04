import sqlite3 from 'sqlite3';
import { Response, Request } from 'express';
import { xeroDBLoggerLog } from './logger';
import path from 'path';
import { exit } from 'process';
import { DatabaseService } from './DatabaseService';
import { createMessageHtml } from './pagegen';

interface LooseObject {
    [key: string]: any
};

export class AuditService extends DatabaseService {
    private static readonly userFileName: string = 'audit.db';

    private static readonly confirmString: string = '/users/confirm';
    private static readonly userInfoString: string = '/users/userinfo';
    private static readonly lostPwdReturnString: string = '/users/lostpwdreturn';
    

    public static readonly UnknownUserError = "USER_SERVICE_UNKNOWN_USER";
    public static readonly IncorrectPasswordError = "USER_SERVICE_INCORRECT_PASSWORD";
    public static readonly UserNotActiveError = "USER_SERVICE_USER_NOT_ACTIVE";

    constructor(rootdir: string) {
        super('audit', path.join(rootdir, AuditService.userFileName)) ;
    }

    protected createTables() {
        let sql =
            `CREATE TABLE login (
                username text not null,
                ipaddr text not null,
                timestamp text not null,
                action text not null);
            ` ;
        this.db().exec(sql, (err) => {
            if (err) {
                let msg: string = this.name() + ": cannot create table 'login' in AuditService" ;
                xeroDBLoggerLog('ERROR', msg);
                throw new Error(msg)
            }
        });

        sql =
            `CREATE TABLE audit (
                username text not null,
                ipaddr text not null,
                timestamp text not null,
                partno text not null,
                desc text not null,
                action text not null);
            ` ;
            this.db().exec(sql, (err) => {
                if (err) {
                    let msg: string = this.name() + ": cannot create table 'audit' in AuditService" ;
                    xeroDBLoggerLog('ERROR', msg);
                    throw new Error(msg)
                }
            });     
    }

    public parts(username: string, ipaddr: string, partno: string, desc: string, action: string) {
        let sql = 'INSERT INTO audit VALUES (';
        sql += "'" + username + "'," ;
        sql += "'" + ipaddr + "'," ;
        sql += "'" + this.now() + "',";
        sql += "'" + partno + "'," ;
        sql += "'" + this.escapeString(desc) + "'," ;
        sql += "'" + this.escapeString(action) + "')" ;
        this.db().exec(sql, (err) => {
            if (err) {
                xeroDBLoggerLog('ERROR', 'AuditService:failed to update audit table - ' + err.message);
                xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
            }
        });
    }

    public users(username: string, ipaddr: string | undefined, action: string) {
        let sql = 'INSERT INTO login VALUES (';
        sql += "'" + username + "'," ;
        if (ipaddr)
            sql += "'" + ipaddr + "'," ;
        else
            sql += "'***UNKNOWN***'," ;
        sql += "'" + this.now() + "',";
        
        sql += "'" + this.escapeString(action) + "')" ;
        this.db().exec(sql, (err) => {
            if (err) {
                xeroDBLoggerLog('ERROR', 'AuditService:failed to update login table - ' + err.message);
                xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
            }
        });
    }

    public updatePartDesc(partno: string, newdesc: string) {
        let sql = 'UPDATE audit SET' ;
        sql += " desc='" + this.escapeString(newdesc) + "'";
        sql += " WHERE partno='" + partno + "'";
        this.db().exec(sql, (err) => {
            if (err) {
                xeroDBLoggerLog('ERROR', 'AuditService:failed to update part desc in audit table - ' + err.message);
                xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
            }
        });
    }

    private async userreport(req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        let sql =
            `
            select username, ipaddr, timestamp, action from login;
            `;
        this.db().all(sql, (err, rows) => {
            if (err) {
                res.status(500).json({});
            }
            else {
                let ret : LooseObject[] = [] ;
                for(let row of rows) {
                    let obj: Object = row as Object;
                    type ObjectKey = keyof typeof obj;
                    const usernameKey = 'username' as ObjectKey;
                    const ipaddrKey = 'ipaddr' as ObjectKey;
                    const timestampKey = 'timestamp' as ObjectKey;
                    const actionKey = 'action' as ObjectKey;

                    let username = (obj[usernameKey] as unknown) as number;
                    let ipaddr = obj[ipaddrKey] as unknown;
                    let timestamp = obj[timestampKey] as unknown;
                    let action = obj[actionKey] as unknown;

                    let lobj : LooseObject = {} ;
                    lobj['title'] = username ;
                    lobj['username'] = username ;
                    lobj['ipaddr'] = ipaddr ;
                    lobj['timestamp'] = timestamp ;
                    lobj['action'] = action ;

                    ret.push(lobj);
                }
                res.json(ret);
            }
        });        
    }

    private async partreport(req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        let sql =
        `
        select username, ipaddr, timestamp, action, partno, desc from audit;
        `;
        this.db().all(sql, (err, rows) => {
            if (err) {
                res.status(500).json({});
            }
            else {
                let ret : LooseObject[] = [] ;
                for(let row of rows) {
                    let obj: Object = row as Object;
                    type ObjectKey = keyof typeof obj;
                    const usernameKey = 'username' as ObjectKey;
                    const ipaddrKey = 'ipaddr' as ObjectKey;
                    const timestampKey = 'timestamp' as ObjectKey;
                    const partnoKey = 'partno' as ObjectKey;
                    const actionKey = 'action' as ObjectKey;
                    const descKey = 'desc' as ObjectKey;

                    let username = (obj[usernameKey] as unknown) as number;
                    let ipaddr = obj[ipaddrKey] as unknown;
                    let timestamp = obj[timestampKey] as unknown;
                    let action = obj[actionKey] as unknown;
                    let partno = obj[partnoKey] as unknown;
                    let desc = obj[descKey] as unknown ;

                    let lobj : LooseObject = {} ;
                    lobj['title'] = partno ;
                    lobj['tooltip'] = desc ;
                    lobj['username'] = username ;
                    lobj['ipaddr'] = ipaddr ;
                    lobj['timestamp'] = timestamp ;
                    lobj['partno'] = partno ;
                    lobj['action'] = action ;
                    lobj['desc'] = desc ;

                    ret.push(lobj);
                }
                res.json(ret);
            }
        });    
    }    

    public get(req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        xeroDBLoggerLog('DEBUG', "HistoryService: rest api '" + req.path + "'");

        let handled: boolean = false;

        if (req.path === '/audit/userreport') {
            this.userreport(req, res);
            handled = true;
        }
        else if (req.path === '/audit/partreport') {
            this.partreport(req, res);
            handled = true;
        }

        if (!handled) {
            let msg: string = 'unknown history REST API request "' + req.path + "'";
            res.status(404).send(createMessageHtml('Unknown Request', msg));
        }
        
    } 
}
