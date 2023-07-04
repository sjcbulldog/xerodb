import sqlite3 from 'sqlite3';
import { xeroDBLoggerLog } from './logger';

export abstract class DatabaseService {
    private static readonly missingErrorMessage: string = 'SQLITE_CANTOPEN';

    private name_ : string ;
    private dbpath_: string;
    private db_: sqlite3.Database;
    
    constructor(name: string, path: string) {
        this.name_ = name ;
        this.dbpath_ = path ;

        this.db_ = new sqlite3.Database(this.dbpath_, sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
                if (err.message.startsWith(DatabaseService.missingErrorMessage)) {
                    this.createDatabaseAndTables();
                }
                else {
                    xeroDBLoggerLog('ERROR', name + ': error opening sqlite database - ' + err.message);
                    throw new Error(name + "cannot create database at path '" + path + "' - " + err.message);
                }
            }
        });
    }

    protected name() : string {
        return this.name_ ;
    }

    protected dbpath() : string {
        return this.dbpath_ ;
    }

    protected db() : sqlite3.Database {
        return this.db_ ;
    }

    protected createDatabaseAndTables() {
        xeroDBLoggerLog('INFO', this.name_ + ': creating new database at path "' + this.dbpath_ + '"');
        this.db_ = new sqlite3.Database(this.dbpath_, (err) => {
            if (err) {
                let msg: string = this.name_ + ': error creating sqlite database - ' + err.message ;
                xeroDBLoggerLog('ERROR', msg);
                throw new Error(msg);
            }
            else {
                this.createTables();
            }
        });
    }

    protected abstract createTables() : void ;

    protected now(): string {
        let d: Date = new Date();
        return d.toLocaleString();
    }

    protected escapeString(str: string): string {
        return str.replace(/\'/g, "''");
    }
}