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
                when text not null,
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
                when text not null,
                partno text not null,
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

    public parts(username: string, ipaddr: string, partno: string, action: string) {
        let sql = 'INSERT INTO login VALUES (';
        sql += "'" + username + "'," ;
        sql += "'" + ipaddr + "'," ;
        sql += "'" + this.now() + "',";
        sql += "'" + partno + "'," ;
        sql += "'" + this.escapeString(action) + "')" ;
        this.db().exec(sql, (err) => {
            if (err) {
                xeroDBLoggerLog('ERROR', 'RobotService: failed to update history table for login - ' + err.message);
                xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
            }
        });
    }

    public users(username: string, ipaddr: string, action: string) {
        let sql = 'INSERT INTO login VALUES (';
        sql += "'" + username + "'," ;
        sql += "'" + this.now() + "',";
        sql += "'" + ipaddr + "'," ;
        sql += "'" + this.escapeString(action) + "')" ;
        this.db().exec(sql, (err) => {
            if (err) {
                xeroDBLoggerLog('ERROR', 'RobotService: failed to update history table for login - ' + err.message);
                xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
            }
        });
    }

    private async getusers(req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
    }

    private async getparts(req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
    }    

    public get(req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        xeroDBLoggerLog('DEBUG', "HistoryService: rest api '" + req.path + "'");

        let handled: boolean = false;

        if (req.path === '/audit/getusers') {
            this.getusers(req, res);
            handled = true;
        }
        else if (req.path === '/audit/getparts') {
            this.getparts(req, res);
            handled = true;
        }

        if (!handled) {
            let msg: string = 'unknown history REST API request "' + req.path + "'";
            res.status(404).send(createMessageHtml('Unknown Request', msg));
        }
        
    } 
}
