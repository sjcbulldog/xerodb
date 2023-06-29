import { Response, Request } from 'express' ;
import path from 'path';
import { exit } from 'process';
import sqlite3 from 'sqlite3' ;
import { User } from './User' ;
import * as crypto from 'crypto' ;
import { createMessageHtml, processPage } from './pagegen';
import { isAdmin, isLoggedIn } from './auth';
import { sendEmail } from './mail' ;
import { XeroDBConfig } from './config' ;

const config = XeroDBConfig.getXeroDBConfig();

interface LooseObject {
    [key: string]: any
} ;

export class UserService {
    private static readonly userFileName: string = 'user.db' ;
    private static readonly missingErrorMessage: string = 'SQLITE_CANTOPEN' ;
    private static readonly confirmString: string = '/users/confirm' ;
    private static readonly userInfoString: string = '/users/userinfo' ;

    private static readonly stateNew = 'NEW' ;
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
        this.dbpath_ = path.join(rootdir, UserService.userFileName);
        this.db_ = new sqlite3.Database(this.dbpath_, sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
                if (err.message.startsWith(UserService.missingErrorMessage)) {
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

    private allUsers() : Object {
        let ret : Object[] = [] ;

        for(let [key, user] of this.users_) {
            let nuser: LooseObject = {} ;
            nuser['email'] = user.email_;
            nuser['username'] = user.username_ ;
            nuser['lastname'] = user.lastname_ ;
            nuser['firstname'] = user.firstname_ ;
            nuser['state'] = user.state_ ;
            nuser['roles'] = user.roles_ ;
            ret.push(nuser);
        }

        return ret;
    }

    private updateUser(u: User) {
        let sql : string = 'UPDATE users SET ' ;
        sql += 'state = "' + u.state_ + '" ' ;
        sql += 'WHERE username="' + u.username_ + '"' ;

        this.db_.exec(sql, (err) => {
            if (err) {
                console.log('UserService: failed to update user "' + u.username_ + '" to the database - ' + err) ;
                console.log('sql: "' + sql + '"') ;
            }
            else {
                console.log('UserService: updated username "' + u.username_ + '" in the database');
            }
        }) ;
    }

    private getUserInfo(u: User) : Object {
        let obj: LooseObject = {} ;

        obj['username'] = u.username_ ;
        obj['firstname'] = u.firstname_ ;
        obj['lastname'] = u.lastname_ ;
        obj['email'] = u.email_ ;
        obj['roles'] = u.roles_ ;
        obj['state'] = u.state_ ;
        return obj ;
    }

    private confirmUser(token: string) {
        console.log('Confirming user token: ' + token);
        let sql = 'select token, username from confirm where token="' + token + '";' ;
        this.db_.all(sql, (err, rows) => {
            rows.forEach(row => {
                let obj: Object = row as Object ;
                type ObjectKey = keyof typeof obj ;
                const tokenKey= 'token' as ObjectKey ;
                const usernameKey = 'username' as ObjectKey ;

                let token = (obj[tokenKey] as unknown) as string ;
                let username = (obj[usernameKey] as unknown) as string ;

                let u: User | null = this.userFromUserName(username);
                if (u != null) {
                    u.state_ = UserService.statePending ;
                    this.updateUser(u);
                }

                sql = 'delete from confirm where token="' + token + '";' ;
                this.db_.exec(sql);
            });
        });
    }

    private getRandomValues(data: Uint8Array) : Uint8Array{
        for(let i = 0 ; i < data.length ; i++) {
            data[i] = Math.floor(Math.random() * 256);
        }

        return data ;
    }

    public get(req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        console.log("UserService: rest api '" + req.path + "'");
        let handled: boolean = false ;

        if (req.path === '/users/register') {
            let roles: string[] = [] ;
            let ret = this.addUser(req.body.username, req.body.password, req.body.lastname, req.body.firstname, req.body.email, null, roles) ;
            if (ret == null) {
              res.redirect('/nologin/confirm.html');
            }
            else {
              res.send(createMessageHtml(ret.message))
            }
            handled = true ;
        }
        else if (req.path === '/users/login') {
            let u : User | Error = this.canUserLogin(req.body.username, req.body.password);
            if (u instanceof User) {
              let data = new Uint8Array(64);
              let cookieval = this.getRandomValues(data);
              let cookiestr = Buffer.from(cookieval).toString('base64');
              res.cookie('xeropartdb', cookiestr);
              u.cookie_ = cookiestr;
          
              if (u.isAdmin()) {
                res.redirect('/admin/menu.html')
              }
              else {
                res.redirect('/normal/menu.html');
              }
            }
            else {
              let err: Error = u as Error ;
              if (err.message == UserService.UserNotActiveError) {
                let msg: string = 'the user "' + req.body.username + '" is not active - see a mentor for more details' ;
                res.send(createMessageHtml(msg));
              }
              else {
                let msg: string = 'the user or password given are not valid' ;
                res.send(createMessageHtml(msg));
              }
            }
            handled = true ;
        }
        else if (req.path.startsWith(UserService.confirmString)) {
            this.confirmUser(req.path.substring(UserService.confirmString.length + 1));
            let msg: string = createMessageHtml('Your account has been confirmed.  It will be available when it is approved by an admin.') ;
            res.send(msg);
            handled = true ;
        }
        else {
            if (isLoggedIn(req, res)) {
                if (req.path.startsWith(UserService.userInfoString)) {
                    let u: User | null = null ;

                    if (req.query.username !== undefined) {
                        u = this.userFromUserName(req.query.username) ;
                    }
                    else {
                        u = this.userFromRequest(req);
                    }

                    if (u === null) {
                        res.json({});
                    }
                    else {
                        res.json(this.getUserInfo(u));
                    }
                    handled = true ;
                }
                else if (req.path === '/users/changepwd') {
                    console.log("changing password");
                    handled = true ;
                }
            }

            if (isAdmin(this, req, res)) {
                if (req.path === '/users/allusers') {
                    res.json(this.allUsers());
                    handled = true ;
                }
                else if (req.path === '/users/editone') {
                    let u: User | null = this.userFromUserName(req.query.username);
                    if (u === null) {
                        res.status(403).send(createMessageHtml("'" + req.query.username + "' is not a valid user")) ;
                    }
                    else {
                        res.send(processPage(u, '/admin/edituser.html'));                    
                    }
                    handled = true ;
                }
            }
        }

        if (!handled) {
            let msg: string = 'unknown users REST API request "' + req.path + "'" ;
            res.status(404).send(createMessageHtml(msg));
        }
    }

    public userFromRequest(req: Request<{}, any, any, any, Record<string, any>>) : User | null {
        if (req.cookies.xeropartdb === undefined)
            return null ;

        for(let [key, user] of this.users_) {
            if (user.cookie_ === req.cookies.xeropartdb) {
                return user ;
            }
        }

        return null;
    }

    public userFromCookie(cookie: string) : User | null {
        for(let [key, user] of this.users_) {
            if (user.cookie_ === cookie) {
                return user ;
            }
        }

        return null;
    }

    public userFromUserName(username: string) : User | null {
        for(let [key, user] of this.users_) {
            if (user.username_ === username) {
                return user ;
            }
        }

        return null;
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

    private sendConfirmationEmail(u: User) {
        let cookie : string = crypto.createHash('sha256').update(u.username_).digest('hex');
        let msg: string = "" ;

        let sql = 'INSERT into confirm VALUES (' ;
        sql += '"' + cookie + '",' ;
        sql += '"' + u.username_ + '");' ;

        this.db_.exec(sql, (err) => {
            if (err) {
                console.log('UserService: failed to add user "' + u.username_ + '" to the confirmation database - ' + err) ;
                console.log('sql: "' + sql + '"') ;
            }
            else {
                msg += 'Please click <a href="' + config.url() + '/users/confirm/' + cookie + '"> here</a> to confirm the user "' + u.username_ + "'";
                sendEmail(u.email_, 'Confirm XeroPartsDB Account', msg);
            }
        }) ;
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
                state = UserService.stateNew;
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
                    if (u.state_ == UserService.stateNew) {
                        this.sendConfirmationEmail(u);
                    }
                    console.log('UserService: added username "' + username + '" to the database');
                }
            }) ;
        }

        return ret;
    }
    
    private hashPassword(pass: string) : string {
        return crypto.createHash('sha256').update(pass).digest('hex');
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

        sql = 
          `CREATE TABLE confirm (
            token text not null,
            username text not null);
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

                let id = (obj[idKey] as unknown) as number ;
                let username = obj[usernameKey] as unknown ;
                let password = obj[passwordKey] as unknown ;
                let lastname = obj[lastnameKey] as unknown ;
                let firstname = obj[firstnameKey] as unknown ;
                let email = obj[emailKey] as unknown ;
                let state = obj[stateKey] as unknown ;
                let roles = obj[rolesKey] as unknown ;
                let u: User = new User(id, username as string, password as string, lastname as string, 
                                        firstname as string, email as string, state as string, roles as string) ;
                this.users_.set(username as string, u) ;

                if (this.nextkey_ < id + 1) {
                    this.nextkey_ = id + 1 ;
                }
            })
        });
    }
}
