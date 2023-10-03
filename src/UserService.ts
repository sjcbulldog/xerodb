import { Response, Request } from 'express';
import path from 'path';
import { exit } from 'process';
import sqlite3 from 'sqlite3';
import { User } from './User';
import * as crypto from 'crypto';
import { createMessageHtml, processPage } from './pagegen';
import { isAdmin, isLoggedIn } from './auth';
import { sendEmail } from './mail';
import { XeroDBConfig } from './config';
import { xeroDBLoggerLog } from './logger';
import { DatabaseService } from './DatabaseService';
import { AuditService } from './AuditService';

const config = XeroDBConfig.getXeroDBConfig();

interface LooseObject {
    [key: string]: any
};

export class UserService extends DatabaseService {
    private static readonly userFileName: string = 'user.db';
    private static readonly confirmString: string = '/users/confirm';
    private static readonly userInfoString: string = '/users/userinfo';
    private static readonly lostPwdReturnString: string = '/users/lostpwdreturn';

    private static readonly cookieName: string = 'xeropartdb';

    private static readonly stateNew = 'NEW';
    private static readonly statePending = 'PENDING';
    private static readonly stateActive = 'ACTIVE';
    private static readonly stateDisabled = 'DISABLED';

    public static readonly UnknownUserError = "USER_SERVICE_UNKNOWN_USER";
    public static readonly IncorrectPasswordError = "USER_SERVICE_INCORRECT_PASSWORD";
    public static readonly UserNotActiveError = "USER_SERVICE_USER_NOT_ACTIVE";

    public static readonly roleStudent = 'student' ;
    public static readonly roleMentor = 'mentor' ;

    nextkey_: number;
    users_: Map<string, User>;
    audit_ : AuditService;

    constructor(rootdir: string, audit: AuditService) {
        super('UserService', path.join(rootdir, UserService.userFileName)) ;
        
        this.audit_ = audit;
        this.nextkey_ = 0;
        this.users_ = new Map<string, User>();
        this.loadUsers();
    }

    private loadUsers() {
        let sql =
            `
            select id, username, password, lastname, firstname, email, state, roles from users;
            `;
        this.db().all(sql, (err, rows) => {
            rows.forEach(row => {
                let obj: Object = row as Object;
                type ObjectKey = keyof typeof obj;
                const idKey = 'id' as ObjectKey;
                const usernameKey = 'username' as ObjectKey;
                const passwordKey = 'password' as ObjectKey;
                const lastnameKey = 'lastname' as ObjectKey;
                const firstnameKey = 'firstname' as ObjectKey;
                const emailKey = 'email' as ObjectKey;
                const stateKey = 'state' as ObjectKey;
                const rolesKey = 'roles' as ObjectKey;

                let id = (obj[idKey] as unknown) as number;
                let username = obj[usernameKey] as unknown;
                let password = obj[passwordKey] as unknown;
                let lastname = obj[lastnameKey] as unknown;
                let firstname = obj[firstnameKey] as unknown;
                let email = obj[emailKey] as unknown;
                let state = obj[stateKey] as unknown;
                let roles = obj[rolesKey] as unknown;
                let u: User = new User(id, username as string, password as string, lastname as string,
                    firstname as string, email as string, state as string, this.roleStringtoRoles(roles as string));
                this.users_.set(username as string, u);

                if (this.nextkey_ < id + 1) {
                    this.nextkey_ = id + 1;
                }
            })
        });
    }

    private delUserFromDb(u: User) {
        let sql: string = 'DELETE FROM users ';
        sql += 'WHERE id="' + u.id_ + '"';

        xeroDBLoggerLog('DEBUG', 'renameUser: ' + sql);

        this.db().exec(sql, (err) => {
            if (err) {
                xeroDBLoggerLog('ERROR', 'UserService: failed to delete user id "' + u.id_ + '" from the database - ' + err);
                xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
            }
            else {
                xeroDBLoggerLog('INFO', 'UserService: deleted user id "' + u.id_ + '" from the database');
            }
        });
    }

    private delUser(req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        let user = this.userFromId(+req.query.id) ;
        if (user !== null)
            this.delUserFromDb(user);
    }

    private allUsers(): Object {
        let ret: Object[] = [];

        for (let [key, user] of this.users_) {
            let nuser: LooseObject = {};
            nuser['title'] = user.username_ ;
            nuser['email'] = user.email_;
            nuser['username'] = user.username_;
            nuser['lastname'] = user.lastname_;
            nuser['firstname'] = user.firstname_;
            nuser['state'] = user.state_;
            nuser['roles'] = user.roles_;

            nuser['rolestr'] = '' ;
            for(let role of user.roles_) {
                if (nuser['rolestr'].length > 0) {
                    nuser['rolestr'] += ',' ;
                }

                nuser['rolestr'] += role;
            }
            ret.push(nuser);
        }

        return ret;
    }

    private emailAddAdmins(u: User) {
        for (let [key, user] of this.users_) {
            if (user.isAdmin()) {
                let msg: string = 'The user ' + u.username_ + ' has confirmed their account and is now pending.';
                msg += '<br>Click <a href="' + config.url() + '">here</a> to log into the XeroDB site.'
                sendEmail(user.email_, 'XeroDB: New User ' + u.username_ + ' pending', msg);
            }
        }
    }

    private updateUser(u: User) {
        let sql: string = 'UPDATE users SET ';
        sql += 'state = "' + u.state_ + '" ';
        sql += ',lastname = "' + u.lastname_ + '" ';
        sql += ',firstname = "' + u.firstname_ + '" ';
        sql += ',email = "' + u.email_ + '" ';
        sql += ',roles = "' + this.rolesToRolesString(u.roles_) + '" ';
        sql += 'WHERE username="' + u.username_ + '"';

        xeroDBLoggerLog('DEBUG', 'updateUser: ' + sql);

        this.db().exec(sql, (err) => {
            if (err) {
                xeroDBLoggerLog('ERROR', 'UserService: failed to update user "' + u.username_ + '" to the database - ' + err);
                xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
            }
            else {
                xeroDBLoggerLog('INFO', 'UserService: updated username "' + u.username_ + '" in the database');

                if (u.state_ == UserService.statePending) {
                    this.emailAddAdmins(u);
                }
            }
        });
    }

    private getUserInfo(u: User): Object {
        let obj: LooseObject = {};

        obj['username'] = u.username_;
        obj['firstname'] = u.firstname_;
        obj['lastname'] = u.lastname_;
        obj['email'] = u.email_;
        obj['roles'] = u.roles_;
        obj['state'] = u.state_;
        return obj;
    }

    private confirmUser(token: string) {
        xeroDBLoggerLog('DEBUG', 'Confirming user token: ' + token);
        let sql = 'select token, username from confirm where token="' + token + '";';
        this.db().all(sql, (err, rows) => {
            rows.forEach(row => {
                let obj: Object = row as Object;
                type ObjectKey = keyof typeof obj;
                const tokenKey = 'token' as ObjectKey;
                const usernameKey = 'username' as ObjectKey;

                let token = (obj[tokenKey] as unknown) as string;
                let username = (obj[usernameKey] as unknown) as string;

                let u: User | null = this.userFromUserName(username);
                if (u != null) {
                    u.state_ = UserService.statePending;
                    this.updateUser(u);
                    this.audit_.users(u.username_, u.ipaddr_, 'confirmed email for user, state set to PENDING');
                }

                sql = 'delete from confirm where token="' + token + '";';
                this.db().exec(sql);
            });
        });
    }

    private lostPasswordStage2(req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        let token = req.path.substring(UserService.lostPwdReturnString.length + 1)
        let sql = 'select token, username from lostpwd where token="' + token + '";';
        this.db().all(sql, (err, rows) => {
            if (rows.length !== 1) {
                sql = 'delete from lostpwd where token="' + token + '";';
                this.db().exec(sql);
                res.send(createMessageHtml('Internal Error', 'internal error with lost password request'));
            }
            else {
                rows.forEach(row => {
                    let obj: Object = row as Object;
                    type ObjectKey = keyof typeof obj;
                    const tokenKey = 'token' as ObjectKey;
                    const usernameKey = 'username' as ObjectKey;

                    let token = (obj[tokenKey] as unknown) as string;
                    let username = (obj[usernameKey] as unknown) as string;

                    let u: User | null = this.userFromUserName(username);
                    if (u != null) {
                        let vars: Map<string, string> = new Map<string, string>();
                        vars.set('$$$TOKEN$$$', token);
                        vars.set('$$$USERNAME$$$', u.username_);
                        res.send(processPage(vars, '/nologin/lostpwd2.html'));
                    }
                    else {
                        res.send(createMessageHtml('Error', 'invalid lost password request'));
                    }
                });
            }
        });
    }

    private getRandomValues(data: Uint8Array): Uint8Array {
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.floor(Math.random() * 256);
        }

        return data;
    }

    private changePassword(u: User, password: string) {
        let hashed: string = this.hashPassword(password);
        if (hashed !== u.password_) {
            let sql: string = 'UPDATE users SET ';
            sql += 'password = "' + hashed + '" ';
            sql += 'WHERE username="' + u.username_ + '"';

            this.db().exec(sql, (err) => {
                if (err) {
                    xeroDBLoggerLog('ERROR', 'UserService: failed to update user "' + u.username_ + '" to the database - ' + err);
                    xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
                }
                else {
                    xeroDBLoggerLog('INFO', 'UserService: updated username "' + u.username_ + '" in the database');
                    u.password_ = hashed;
                }
            });
        }
    }

    private async processNewPassword(req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        let sql = 'select token, username from lostpwd where token="' + req.body.token + '";';
        this.db().all(sql, (err, rows) => {
            if (rows.length !== 1) {
                sql = 'delete from lostpwd where token="' + req.body.token + '";';
                this.db().exec(sql);
                res.send(createMessageHtml('Internal Error', 'internal error with lost password request'));
            }
            else {
                rows.forEach(row => {
                    let obj: Object = row as Object;
                    type ObjectKey = keyof typeof obj;
                    const tokenKey = 'token' as ObjectKey;
                    const usernameKey = 'username' as ObjectKey;

                    let token = (obj[tokenKey] as unknown) as string;
                    let username = (obj[usernameKey] as unknown) as string;

                    let u: User | null = this.userFromUserName(username);
                    if (u != null) {
                        let hashed: string = this.hashPassword(req.body.newpwd);
                        if (hashed !== u.password_) {
                            let sql: string = 'UPDATE users SET ';
                            sql += 'password = "' + hashed + '" ';
                            sql += 'WHERE username="' + u.username_ + '"';

                            this.db().exec(sql, (err) => {
                                if (err) {
                                    xeroDBLoggerLog('ERROR', 'UserService: failed to update user "' + u!.username_ + '" to the database - ' + err);
                                    xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');

                                    res.send(createMessageHtml('Password Reset Failed', err.message));
                                }
                                else {
                                    xeroDBLoggerLog('INFO', 'UserService: updated username "' + u!.username_ + '" in the database');
                                    u!.password_ = hashed;
                                }
                            });

                            res.send(createMessageHtml('Password Reset', 'You password has been reset'));
                        }
                        else {
                            res.send(createMessageHtml('Reset Password Failed', 'Your password is identical to your existing password.'));
                        }
                    }
                    else {
                        res.send(createMessageHtml('Error', 'invalid lost password request'));
                    }
                });
            }
        });
    }

    private diffRoles(current: string[], prev: string[]) : string {
        let ret: string = '' ;

        let added: string[] = [] ;
        for(let role of current) {
            if (prev.indexOf(role) === -1) {
                added.push(role) ;
            }
        }

        let removed: string[] = [] ;
        for(let role of prev) {
            if (current.indexOf(role) === -1) {
                removed.push(role) ;
            }
        }

        if (added.length) {
            ret += "roles added: " ;
            let first: boolean = true ;
            for(let role of added) {
                if (!first) {
                    ret += "," ;
                }
                else {
                    first = false ;
                }            
                ret += role ;
            }
        }

        if (removed.length) {
            ret += "roles removed: " ;
            let first: boolean = true ;
            for(let role of removed) {
                if (!first) {
                    ret += "," ;
                }
                else {
                    first = false ;
                }            
                ret += role ;
            }
        }        

        return ret ;
    }
    
    private editOneDone(req: Request<{}, any, any, any, Record<string, any>>): Error | null {
        let ret: Error | null = null;

        let uch: User | null = this.userFromRequest(req);
        let lu: string = '*UNKNOWN*' ;
        if (uch !== null) {
            lu = uch.username_ ;
        }

        let u: User | null = this.userFromUserName(req.body.username);
        if (u === null) {
            ret = new Error('invalid user name "' + req.body.username + '"');
        }
        else {
            if (req.body.password.length > 0) {
                this.audit_.users(lu, req.socket.remoteAddress, 'user "' + u.username_ + '" password changed');
                this.changePassword(u, req.body.password);
            }

            if (u.state_ === UserService.statePending && req.body.state === UserService.stateActive) {
                sendEmail(u.email_, 'XeroDB Account Active', 'Your XeroDB account is now active and ready for use.');
            }

            let oldst: string = u.state_ ;
            let oldroles: string[] = u.roles_ ;
            let oldemail: string = u.email_ ;

            u.email_ = req.body.email;
            u.firstname_ = req.body.firstname;
            u.lastname_ = req.body.lastname
            u.state_ = req.body.state;

            u.roles_ = [] ;
            if (req.body.admin && req.body.admin === 'on') {
                u.roles_.push('admin');
            }

            if (req.body.mentor && req.body.mentor === 'on') {
                u.roles_.push(UserService.roleMentor);
            }

            if (req.body.student && req.body.student === 'on') {
                u.roles_.push(UserService.roleStudent);
            }

            this.updateUser(u);

            if (oldst != u.state_) {
                this.audit_.users(lu, req.socket.remoteAddress, 'user "' + u.username_ + '" state changed "' + oldst.toString() + '"->"' + u.state_.toString() + '"');
            }

            let diffr: string = this.diffRoles(u.roles_, oldroles) ;
            if (diffr.length > 0) {
                this.audit_.users(lu, req.socket.remoteAddress, 'user "' + u.username_ + '" ' + diffr) ;
            }

            if (oldemail !== u.email_) {
                this.audit_.users(lu, req.socket.remoteAddress, 'user "' + u.username_ + '" email changed "' + oldemail + '"->"' + u.email_ + '"');
            }

            let changer: string = "" ;
            if (uch === null) {
                changer = "(null)" ;
            }
            else {
                changer = uch.username_ ;
            }
        }

        return ret;
    }

    private async lostPassword(req: Request<{}, any, any, any, Record<string, any>>) {
        let email: string = req.body.email;
        let u: User | null = null;

        if (email === undefined || email.length === 0) {
            u = this.userFromUserName(req.body.username);
        }
        else {
            u = this.userFromEmail(email);
        }

        if (u != null) {
            this.sendLostPasswordEmail(u);
        }
    }

    private async withRole(req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {

        if (!req.query || !req.query.role) {
            res.send(createMessageHtml('Error', 'invalid call to USERS rest API /users/withrole')) ;
            return ;
        }

        let result : string[]  = [] ;
        for(let [key, value] of this.users_) {
            if (value.roles_.indexOf(req.query.role) !== -1) {
                result.push(value.username_);
            }
        }
        res.json(result);
    }


    public userFromRequest(req: Request<{}, any, any, any, Record<string, any>>): User | null {
        if (req.cookies.xeropartdb === undefined)
            return null;

        for (let [key, user] of this.users_) {
            if (user.cookie_ === req.cookies.xeropartdb) {
                return user;
            }
        }

        return null;
    }

    public userFromCookie(cookie: string): User | null {
        for (let [key, user] of this.users_) {
            if (user.cookie_ === cookie) {
                return user;
            }
        }

        return null;
    }

    public userFromUserName(username: string): User | null {
        for (let [key, user] of this.users_) {
            if (user.username_ === username) {
                return user;
            }
        }

        return null;
    }

    public userFromId(id: number): User | null {
        for (let [key, user] of this.users_) {
            if (user.id_ === id) {
                return user;
            }
        }

        return null;
    }    

    public userFromEmail(email: string): User | null {
        for (let [key, user] of this.users_) {
            if (user.email_ === email) {
                return user;
            }
        }

        return null;
    }

    public canUserLogin(username: string, password: string): Error | User {
        let ret: Error | User = new Error(UserService.UnknownUserError);

        if (!this.users_.has(username)) {
            ret = new Error(UserService.UnknownUserError);
        }
        else {
            let u: User = this.users_.get(username)!;

            let hashed: string = this.hashPassword(password);
            if (hashed !== u.password_) {
                ret = new Error(UserService.IncorrectPasswordError);
            }
            else {
                ret = u;
            }
        }

        return ret;
    }

    private sendLostPasswordEmail(u: User) {
        let token: string = crypto.createHash('sha256').update(u.username_).digest('hex');
        let msg: string = "";

        //
        // Delete any old lost password records for this user or token
        //
        let sql: string = 'delete from lostpwd where username="' + u.username_ + '";';
        this.db().exec(sql);

        sql = 'delete from lostpwd where token="' + token + '";';
        this.db().exec(sql);

        //
        // Create one new record for this user
        //
        sql = 'INSERT into lostpwd VALUES (';
        sql += '"' + token + '",';
        sql += '"' + u.username_ + '");';

        this.db().exec(sql, (err) => {
            if (err) {
                xeroDBLoggerLog('ERROR', 'UserService: failed to add user "' + u.username_ + '" to the lost password database - ' + err);
                xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
            }
            else {
                msg += 'Please click <a href="' + config.url() + '/users/lostpwdreturn/' + token + '"> here</a> to reset your password "' + u.username_ + "'";
                sendEmail(u.email_, 'Lost XeroPartsDB Account Password', msg);
            }
        });
    }

    private sendConfirmationEmail(u: User) {
        let cookie: string = crypto.createHash('sha256').update(u.username_).digest('hex');
        let msg: string = "";

        let sql = 'INSERT into confirm VALUES (';
        sql += '"' + cookie + '",';
        sql += '"' + u.username_ + '");';

        this.db().exec(sql, (err) => {
            if (err) {
                xeroDBLoggerLog('ERROR', 'UserService: failed to add user "' + u.username_ + '" to the confirmation database - ' + err);
                xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
            }
            else {
                msg += 'Please click <a href="' + config.url() + '/users/confirm/' + cookie + '"> here</a> to confirm the user "' + u.username_ + "'";
                sendEmail(u.email_, 'Confirm XeroPartsDB Account', msg);
            }
        });
    }

    private rolesToRolesString(roles: string[]): string {
        let rolestr: string = "";
        for (let role of roles) {
            if (rolestr.length > 0) {
                rolestr += ",";
            }
            rolestr += role;
        }

        return rolestr;
    }

    private roleStringtoRoles(rolesstr: string): string[] {
        return rolesstr.split(',');
    }

    private isDigit(ch: string ) : boolean {
        return ch.length === 1 && ch >= '0' && ch <= '9' ;
    }

    private isAlpha(ch: string) : boolean {
        return ch.length === 1 && ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) ;
    }

    private isValidUserName(uname: string) : boolean {
        for(let ch of uname) {
            if (!this.isDigit(ch) && !this.isAlpha(ch) && ch !== '_' && ch != '.')
                return false ;
        }
        return true ;
    }

    public addUser(username: string, password: string, lastname: string, firstname: string, email: string, state: string | null, roles: string[]): Error | null {
        let ret: Error | null = null;

        if (this.users_.has(username)) {
            ret = new Error("A user with the name '" + username + "' already exists");
        }
        else if (this.userFromEmail(email) !== null) {
            ret = new Error("An account with the email '" + email + "' already exists");
        }
        else if (!this.isValidUserName(username)) {
            ret = new Error("The username '" + username + "' is not valid.  You can only use letters, numbers, period, or underscore");
        }
        else {
            let rolestr: string = this.rolesToRolesString(roles);
            password = this.hashPassword(password);

            if (state === null) {
                state = UserService.stateNew;
            }

            let sql = 'INSERT INTO users VALUES (';
            sql += String(this.nextkey_) + ',';
            sql += '"' + username + '",';
            sql += '"' + password + '",';
            sql += '"' + lastname + '",';
            sql += '"' + firstname + '",';
            sql += '"' + email + '",';
            sql += '"' + state + '",';
            sql += '"' + rolestr + '");';
            this.db().exec(sql, (err) => {
                if (err) {
                    xeroDBLoggerLog('ERROR', 'UserService: failed to add user "' + username + '" to the database - ' + err);
                    xeroDBLoggerLog('DEBUG', 'sql: "' + sql + '"');
                }
                else {
                    let u: User = new User(this.nextkey_, username, password, lastname, firstname, email, state!, roles);
                    this.users_.set(username, u);
                    this.nextkey_++;
                    if (u.state_ == UserService.stateNew) {
                        this.sendConfirmationEmail(u);
                    }
                    xeroDBLoggerLog('INFO', 'UserService: added username "' + username + '" to the database');
                }
            });
        }

        return ret;
    }

    private hashPassword(pass: string): string {
        return crypto.createHash('sha256').update(pass).digest('hex');
    }

    protected createTables() {
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
        this.db().exec(sql, (err) => {
                if (err) {
                    let msg: string = this.name() + ": cannot create table 'users' in UserService" ;
                    xeroDBLoggerLog('ERROR', msg);
                    throw new Error(msg)
                }
        });

        sql =
            `CREATE TABLE confirm (
                token text not null,
                username text not null);
          ` ;
        this.db().exec(sql, (err) => {
            if (err) {
                let msg: string = this.name() + ": cannot create table 'confirm' in UserService" ;
                xeroDBLoggerLog('ERROR', msg);
                throw new Error(msg)
            }
        });

        sql =
            `CREATE TABLE lostpwd (
                token text not null,
                username text not null);
            ` ;
        this.db().exec(sql, (err) => {
            if (err) {
                let msg: string = this.name() + ": cannot create table 'lostpwd' in UserService" ;
                xeroDBLoggerLog('ERROR', msg);
                throw new Error(msg)
            }
        });

        let roles: string[] = ['admin', 'mentor'];
        this.addUser('admin', 'password', 'Doe', 'John', '', UserService.stateActive, roles);
    }

    public get(req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        xeroDBLoggerLog('DEBUG', "UserService: rest api '" + req.path + "'");
        let handled: boolean = false;

        if (req.path === '/users/lostpwd') {
            this.lostPassword(req);
            res.send(createMessageHtml('Lost Password', 'If the username or email were valid, look for email instructions.  If they do not arrive, check your SPAM or JUNK folder'));
            handled = true;
        }
        else if (req.path === '/users/withrole') {
            this.withRole(req, res);
            handled = true ;
        }
        else if (req.path === '/users/lostpwd2') {
            this.processNewPassword(req, res);
            handled = true;
        }
        else if (req.path.startsWith(UserService.lostPwdReturnString)) {
            this.lostPasswordStage2(req, res);
            handled = true;
        }
        else if (req.path === '/users/register') {
            let roles: string[] = [];
            let ret = this.addUser(req.body.username, req.body.password, req.body.lastname, req.body.firstname, req.body.email, null, roles);
            if (ret == null) {
                res.redirect('/nologin/confirm.html');
                this.audit_.users(req.body.username, req.socket.remoteAddress, 'user registered');
            }
            else {
                res.send(createMessageHtml('Error', ret.message))
            }
            handled = true;
        }
        else if (req.path === '/users/login') {
            let u: User | Error = this.canUserLogin(req.body.username, req.body.password);
            if (u instanceof User) {
                if (req.socket.remoteAddress) {
                    u.ipaddr_ = req.socket.remoteAddress ;
                }
                if (u.state_ === UserService.stateActive) {
                    let data = new Uint8Array(64);
                    let cookieval = this.getRandomValues(data);
                    let cookiestr = Buffer.from(cookieval).toString('base64');
                    res.cookie(UserService.cookieName, cookiestr);
                    u.cookie_ = cookiestr;
                    res.redirect('/menu')
                    xeroDBLoggerLog('INFO', 'the user "' + u.username_ + '" has logged into the system');
                    this.audit_.users(u.username_, u.ipaddr_, 'user logged into the system');
                }
                else if (u.state_ === UserService.stateDisabled) {
                    this.audit_.users(u.username_, u.ipaddr_, 'disabled user tried to log in');
                    res.send(createMessageHtml('Disabled Account','Your account has been disabled.  Please talk to a mentor about this issue'));
                }
                else if (u.state_ === UserService.stateNew) {
                    this.audit_.users(u.username_, u.ipaddr_, "new user tried to log in, sent additional confirmation email to address '" + u.email_ + "'");
                    this.sendConfirmationEmail(u);
                    res.send(createMessageHtml('New User', 'You have not confirmed your email address.  A new confirmation email has been sent.  Please click the link in the confirmation email to confirm your email address.'));
                }
                else if (u.state_ === UserService.statePending) {
                    this.audit_.users(u.username_, u.ipaddr_, 'pending user tried to log in');
                    res.send(createMessageHtml('Awaiting Approval','Your account is pending approval by an administrator of this system.'));
                }
            }
            else {
                let err: Error = u as Error;
                if (err.message == UserService.UserNotActiveError) {
                    let msg: string = 'the user "' + req.body.username + '" is not active - see a mentor for more details';
                    res.send(createMessageHtml('Account Disabled', msg));
                }
                else {
                    let msg: string = 'the user or password given are not valid';
                    res.send(createMessageHtml('Invalid Login', msg, '<a href="/nologin/login.html">Go to login page</a>'));
                }
            }
            handled = true;
        }
        else if (req.path === '/users/rlogin') {
            let json: LooseObject = {} ;

            let u: User | Error = this.canUserLogin(req.query.username, req.query.password);
            if (u instanceof User) {
                if (req.socket.remoteAddress) {
                    u.ipaddr_ = req.socket.remoteAddress ;
                }
                if (u.state_ === UserService.stateActive) {
                    let data = new Uint8Array(64);
                    let cookieval = this.getRandomValues(data);
                    let cookiestr = Buffer.from(cookieval).toString('base64');
                    json['cookie'] = cookiestr ;
                    this.audit_.users(u.username_, u.ipaddr_, 'user logged into the system');
                }
                else if (u.state_ === UserService.stateDisabled) {
                    this.audit_.users(u.username_, u.ipaddr_, 'disabled user tried to log in');
                    json['error'] = 'Your account has been disabled.  Please talk to a mentor about this issue' ;
                }
                else if (u.state_ === UserService.stateNew) {
                    this.audit_.users(u.username_, u.ipaddr_, "new user tried to log in, sent additional confirmation email to address '" + u.email_ + "'");
                    this.sendConfirmationEmail(u);
                    json['error'] = 'You have not confirmed your email address.  A new confirmation email has been sent.  Please click the link in the confirmation email to confirm your email address.';
                }
                else if (u.state_ === UserService.statePending) {
                    this.audit_.users(u.username_, u.ipaddr_, 'pending user tried to log in');
                    json['error'] = 'Your account is pending approval by an administrator of this system.' ;
                }
            }
            else {
                let err: Error = u as Error;
                if (err.message == UserService.UserNotActiveError) {
                    json['error'] = 'the user "' + req.body.username + '" is not active - see a mentor for more details';
                }
                else {
                    json['error'] = 'the user or password given are not valid';
                }
            }
            res.json(json);
            handled = true;
        }
        else if (req.path === '/users/logout') {
            res.clearCookie(UserService.cookieName);
            res.redirect('/');
            handled = true;
        }
        else if (req.path.startsWith(UserService.confirmString)) {
            this.confirmUser(req.path.substring(UserService.confirmString.length + 1));
            let msg: string = createMessageHtml('Confirmation Sucessful', 'Your account has been confirmed.  It will be available when it is approved by an admin.');
            res.send(msg);
            handled = true;
        }
        else {
            if (isLoggedIn(req, res)) {
                if (req.path.startsWith(UserService.userInfoString)) {
                    let u: User | null = null;

                    if (req.query.username !== undefined) {
                        u = this.userFromUserName(req.query.username);
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
                    handled = true;
                }
                else if (req.path === '/users/changepwd') {
                    let u: User | null = this.userFromRequest(req);
                    if (u === null) {
                        res.status(403).send(createMessageHtml('Error', "invalid user - did you time out"));
                    }
                    else {
                        let hashed: string = this.hashPassword(req.body.oldpwd);
                        if (hashed !== u.password_) {
                            res.status(400).send(createMessageHtml('Error', "the old password was not valid"));
                        }
                        else if (req.body.newpwd !== req.body.secondpwd) {
                            res.status(400).send(createMessageHtml('Error', "the new passwords did not match"));
                        }
                        else {
                            this.changePassword(u, req.body.newpwd);
                            res.redirect("/normal/dashdef.html");
                        }
                    }
                    handled = true;
                }
                else if (req.path === '/users/changepassword') {
                    let u: User | null = this.userFromRequest(req);
                    if (u === null) {
                        res.status(403).send(createMessageHtml('Invalid User', "'" + req.query.username + "' is not a valid user"));
                    }
                    else {
                        let vars: Map<string, string> = new Map<string, string>();
                        vars.set('$$$USERNAME$$$', u.username_);
                        vars.set('$$$USERMAIL$$$', u.email_);
                        res.send(processPage(vars, '/normal/changepwd.html'));
                    }
                    handled = true;
                }
            }

            if (isAdmin(this, req, res)) {
                if (req.path === '/users/allusers') {
                    res.json(this.allUsers());
                    handled = true;
                }
                else if (req.path === '/users/editone') {
                    let u: User | null = this.userFromUserName(req.query.username);
                    if (u === null) {
                        res.status(403).send(createMessageHtml('Invalid User', "'" + req.query.username + "' is not a valid user"));
                    }
                    else {
                        let vars: Map<string, string> = new Map<string, string>();
                        vars.set('$$$USERNAME$$$', u.username_);
                        vars.set('$$$USERMAIL$$$', u.email_);
                        res.send(processPage(vars, '/admin/edituser.html'));
                    }
                    handled = true;
                }
                else if (req.path === '/users/editonedone') {
                    let result: Error | null = this.editOneDone(req);
                    if (result === null) {
                        res.redirect('/admin/editusers.html');
                    }
                    else {
                        res.send(createMessageHtml('Error', 'Edit user failed - ' + result.message));
                    }
                    handled = true;
                }
            }
        }

        if (!handled) {
            let msg: string = 'unknown users REST API request "' + req.path + "'";
            res.status(404).send(createMessageHtml('Unknown Request', msg));
        }
    }

    public getEmailFromUser(user: string) : string | null {
        if (this.users_.has(user))
            return this.users_.get(user)!.email_ ;

        return null;
    }
}

