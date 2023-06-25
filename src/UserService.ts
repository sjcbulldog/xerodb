import path from 'path';
import { exit } from 'process';
import sqlite3 from 'sqlite3' ;
import { User } from './User' ;
import * as cyprto from 'crypto' ;

export class UserService {
    private readonly userFileName: string = 'user.db' ;
    private readonly missingErrorMessage: string = 'SQLITE_CANTOPEN' ;

    private static readonly statePending = 'PENDING' ;
    private static readonly stateActive = 'ACTIVE' ;
    private static readonly stateDisabled = 'DISABLED' ;

    public static readonly UnknownUserError = "USER_SERVICE_UNKNOWN_USER" ;
    public static readonly IncorrectPasswordError = "USER_SERVICE_INCORRECT_PASSWORD" ;
    public static readonly UserNotActiveError = "USER_SERVICE_USER_NOT_ACTIVE" ;

    nextkey_ : number ;
    dbpath_ : string ;
    db_ : sqlite3.Database ;
    users_ : Map<string, User> ;

    constructor(rootdir: string) {
        this.nextkey_ = 0 ;
        this.users_ = new Map<string, User>() ;
        this.dbpath_ = path.join(rootdir, this.userFileName);
        this.db_ = new sqlite3.Database(this.dbpath_, sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
                if (err.message.startsWith(this.missingErrorMessage)) {
                    this.createDatabaseAndTables() ;
                    return ;
                }
                else {
                    console.log('UserService: error opening sqlite database');
                    exit(1) ;
                }
            }
            else {
                this.loadUsers() ;
            }
        }) ;
    }

    public canUserLogin(username: string, password: string) : Error | User {
        let ret : Error | User = new Error(UserService.UnknownUserError) ;

        if (!this.users_.has(username)) {
            ret = new Error(UserService.UnknownUserError);
        }
        else {
            let u: User = this.users_.get(username)!;

            let hashed : string = this.hashPassword(password) ;
            if (hashed !== u.password_) {
                ret = new Error(UserService.IncorrectPasswordError);
            }
            else {
                if (u.state_ !== UserService.stateActive) {
                    ret = new Error(UserService.UserNotActiveError);
                }
                else {
                    ret = u ;
                }
            }
        }

        return ret ;
    }

    public addUser(username: string, password: string, lastname: string, firstname: string, email: string, state: string | null, roles: string[]) : Error | null {
        let ret: Error | null = null ;

        if (this.users_.has(username)) {
            ret = new Error("duplicate username '" + username + "' requested");
        }
        else {
            let rolestr: string = "" ;
            for (let role of roles) {
                if (rolestr.length > 0) {
                    rolestr += "," ;
                }
                rolestr += role ;
            }

            password = this.hashPassword(password);

            if (state === null) {
                state = UserService.statePending;
            }

            let sql = 'INSERT INTO users VALUES (' ;
            sql += String(this.nextkey_) + ',';
            sql += '"' + username + '",' ;
            sql += '"' + password + '",' ;
            sql += '"' + lastname + '",' ;
            sql += '"' + firstname + '",' ;
            sql += '"' + email + '",' ;
            sql += '"' + state + '",' ;
            sql += '"' + rolestr + '");' ;
            this.db_.exec(sql, (err) => {
                if (err) {
                    console.log('UserService: failed to add user "' + username + '" to the database - ' + err) ;
                    console.log('sql: "' + sql + '"') ;
                }
                else {
                    let u: User = new User(this.nextkey_, username, password, lastname, firstname, email, state!, rolestr);
                    this.users_.set(username, u) ;
                    this.nextkey_++ ;
                    console.log('UserService: added username "' + username + '" to the database');
                }
            }) ;
        }

        return ret;
    }
    
    private hashPassword(pass: string) : string {
        return cyprto.createHash('sha256').update(pass).digest('hex');
    }

    private createDatabaseAndTables() {
        console.log('UserService: creating new database at path "' + this.dbpath_ + '"') ;
        this.db_ = new sqlite3.Database(this.dbpath_, (err) => {
            if (err) {
                console.log('UserService: error creating sqlite database - ' + err.message);
                exit(1) ;
            }
            else {
                this.createTables() ;
                let roles : string[] = ['admin'] ;
                this.addUser('admin', 'grond1425', 'Griffin', 'Butch', 'butchg@comcast.net', UserService.stateActive, roles);
            }
        }) ;
    }

    private createTables() {
        let sql = 
            `CREATE TABLE users (
                id int primary key not null,
                username text not null,
                password text not null,
                lastname text not null,
                firstname text not null,
                email text not null,
                state text not null,
                roles text);
            ` ;
        this.db_.exec(sql)
    }

    private loadUsers() {
        let sql = 
            `
            select id, username, password, lastname, firstname, email, state, roles from users;
            `;
        this.db_.all(sql, (err, rows) => {
            rows.forEach(row => {
                let obj: Object = row as Object ;
                type ObjectKey = keyof typeof obj ;
                const idKey= 'id' as ObjectKey ;
                const usernameKey = 'username' as ObjectKey ;
                const passwordKey = 'password' as ObjectKey ;
                const lastnameKey = 'lastname' as ObjectKey ;
                const firstnameKey = 'firstname' as ObjectKey ;
                const emailKey = 'email' as ObjectKey ;
                const stateKey = 'state' as ObjectKey ;
                const rolesKey = 'roles' as ObjectKey ;

                let id = obj[idKey] as unknown ;
                let username = obj[usernameKey] as unknown ;
                let password = obj[passwordKey] as unknown ;
                let lastname = obj[lastnameKey] as unknown ;
                let firstname = obj[firstnameKey] as unknown ;
                let email = obj[emailKey] as unknown ;
                let state = obj[stateKey] as unknown ;
                let roles = obj[rolesKey] as unknown ;
                let u: User = new User(id as number, username as string, password as string, lastname as string, 
                                        firstname as string, email as string, state as string, roles as string) ;
                this.users_.set(username as string, u) ;
            })
        });
    }
}
