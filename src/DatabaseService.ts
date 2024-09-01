import path from 'path';
import sqlite3, { Database } from 'sqlite3';
import { xeroDBLoggerLog } from './logger';

export abstract class DatabaseService {
    private static readonly missingErrorMessage: string = 'SQLITE_CANTOPEN';
    private static version_db_ : sqlite3.Database | undefined = undefined ;
    private static versions_ : Map<string, number> = new Map<string, number>() ;

    private name_ : string ;
    private dbpath_: string;
    private db_: sqlite3.Database;
    
    protected constructor(name: string, path: string, version: number, rootdir: string) {

        this.name_ = name ;
        this.dbpath_ = path ;

        if (!DatabaseService.versions_.has(name)) {
            DatabaseService.versions_.set(name, 1) ;
            DatabaseService.flushOneDatabaseVersion(name) ;
        }


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
            else {
                //
                // See if a schema migration is necessary
                //
                let current : number | undefined = this.getSchemaVersion() ;
                if (current && current < version) {
                    this.migrateTables(current, version) ;
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
    protected abstract migrateTables(oldver: number, newver: number) : void ;

    protected now(): string {
        let d: Date = new Date();
        return d.toLocaleString();
    }

    protected escapeString(str: string): string {
        return str.replace(/\'/g, "''");
    }

    private getSchemaVersion() : number | undefined {
        return DatabaseService.versions_.get(this.name_) ;
    }

    protected updateSchemaVersion(version: number) {
        DatabaseService.versions_.set(this.name_, version) ;
        DatabaseService.flushOneDatabaseVersion(this.name_) ;
    }

    private static async createVersionDatabase(verpath: string) : Promise<boolean> {
        let ret: Promise<boolean> = new Promise<boolean>((resolve, reject) => {
            xeroDBLoggerLog('INFO', 'versiondb : creating new version database at path "' + verpath + '"');
            DatabaseService.version_db_ = new sqlite3.Database(verpath, (err) => {
                if (err) {
                    let msg: string = 'versiondb: error creating sqlite database - ' + err.message ;
                    xeroDBLoggerLog('ERROR', msg);
                    reject(err) ;
                }
                else {
                    let sql = 'CREATE TABLE versions (dbname text not null, version int not null) ; '; 
                    DatabaseService.version_db_!.exec(sql, (err) => {
                        if (err) {
                            let msg: string = "versiondb: cannot create table 'versions' in RobotService" ;
                            xeroDBLoggerLog('ERROR', msg);
                            reject(err) ;
                        }
                        else {
                            resolve(true) ;
                        }
                    });                
                }
            });
        }) ;

        return ret ;
    }

    private static flushOneDatabaseVersion(db: string) {
        let version: number | undefined = DatabaseService.versions_.get(db) ;
        let sql = 'INSERT OR REPLACE INTO versions (dbname, version) values ("' + db + '", ' + version! + ');' ;
        DatabaseService.version_db_!.exec(sql, (err) => {
            if (err) {
                let msg: string = db + ": cannot create table 'robots' in RobotService" ;
                xeroDBLoggerLog('ERROR', msg);
                throw new Error(msg)
            }
        });            
    }

    public static flushVersionDatabase() {
        for(let key of DatabaseService.versions_.keys()) {
            this.flushOneDatabaseVersion(key) ;
        }
    }

    public static async createOrOpenVersionDB(rootdir: string) : Promise<boolean> {
        let verpath: string = path.join(rootdir, "version.db") ;
        let ret: Promise<boolean> = new Promise<boolean>((resolve, reject) => {
            DatabaseService.version_db_ = new sqlite3.Database(verpath, sqlite3.OPEN_READWRITE, (err) => {
                if (err) {
                    if (err.message.startsWith(DatabaseService.missingErrorMessage)) {
                        DatabaseService.createVersionDatabase(verpath)
                            .then((st: boolean) => {
                                resolve(true) ;
                            })
                            .catch((err) => {
                                reject(err) ;
                            })
                    }
                    else {
                        xeroDBLoggerLog('ERROR', name + ': error opening version database - ' + err.message);
                        throw new Error(name + "cannot create version database at verpath '" + path + "' - " + err.message);
                    }
                }
                else {
                    //
                    // Read the version db contents
                    //
                    let sql = 'select dbname, version from versions' ;
                    DatabaseService.version_db_!.all(sql, (err, rows) => {
                        for (let row of rows) {  
                            let obj: Object = row as Object;
                            type ObjectKey = keyof typeof obj;
                            const dbNameKey = 'dbname' as ObjectKey;
                            const versionKey = 'version' as ObjectKey;

                            let dbname: string = (obj[dbNameKey] as unknown) as string ;
                            let version: number = (obj[versionKey] as unknown) as number ;

                            DatabaseService.versions_.set(dbname, version) ;
                        }
                        resolve(true) ;
                    }) ;
                }
            }) ;
        }) ;

        return ret ;
    }
}
