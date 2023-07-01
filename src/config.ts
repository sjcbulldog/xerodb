import dotenv from 'dotenv' ;
import path from 'path';
import fs from 'fs' ;

export class EmailConfig
{
    public user: string ;
    public password: string ;
    public host: string ;
    public port: number ;

    constructor(u: string, p: string, h: string, n: number) {
        this.user = u ;
        this.password = p ;
        this.host = h ;
        this.port = n ;
    }
}

export class XeroDBConfig
{
    private static config: XeroDBConfig = new XeroDBConfig();

    private datadir_ : string ;
    private contentdir_ : string ;
    private securitydir_ : string ;
    private logdir_ : string ;
    private url_ : string ;
    private port_ : number ;
    private email_ : EmailConfig ;
    private production_ : boolean ;

    public static getXeroDBConfig() : XeroDBConfig {
        return XeroDBConfig.config ;
    }

    constructor() {
        dotenv.config() ;

        if (process.env.PRODUCTION == undefined) {
            throw new Error('The value PRODUCTION is not defined in the .env file');
        }

        if (process.env.PRODUCTION === 'true') {
            this.production_ = true ;

            if (process.env.DATADIR !== undefined) {
                this.datadir_ = process.env.DATADIR! ;
            }
            else {
                this.datadir_ = path.join(__dirname, '..', 'data') ;
            }

            if (process.env.LOGDIR !== undefined) {
                this.logdir_ = process.env.LOGDIR! ;
            }
            else {
                this.logdir_ = path.join(__dirname, '..', 'logs') ;
            }

            if (process.env.CONTENTDIR !== undefined) {
                this.contentdir_ = process.env.CONTENTDIR! ;
            }
            else {
                this.contentdir_ = path.join(__dirname, '..', 'content') ;                
            }

            if (process.env.SECURITYDIR !== undefined) {
                this.securitydir_ = process.env.SECURITYDIR;
            }
            else {
                this.securitydir_ = path.join(__dirname, '..', 'security') ;
            }            

            if (process.env.URL === undefined) {
                throw new Error('the ".env" value URL is not defined');
            }
            else {
                this.url_ = process.env.URL ;
            }

            if (process.env.PORT === undefined) {
                throw new Error('the ".env" value PORT is not defined');
            }
            else {
                this.port_ = parseInt(process.env.PORT, 10);
                if (isNaN(this.port_) || this.port_ <= 0 || this.port_ > 65535) {
                    throw new Error('the ".env" value PORT is not valid - must be an integer greater than 0 and less than 65535') ;
                }
            }

        } else if (process.env.PRODUCTION === 'false') {
            this.production_ = false ;
            this.datadir_ = path.join(__dirname, '..', 'data') ;
            this.contentdir_ = path.join(__dirname, '..','content') ;
            this.securitydir_ = path.join(__dirname, '..', 'security') ;
            this.logdir_ = path.join(__dirname, '..', 'logs') ;
            this.port_ = 8000 ;
            this.url_ = 'http://127.0.0.1:' + this.port_ ;
        }
        else {
            throw new Error('the ".env" value PRODUCTIONS is not valid - must be either "true" or "false"');
        }

        if (!fs.existsSync(this.datadir_)) {
            fs.mkdirSync(this.datadir_)
            if (!fs.existsSync(this.datadir_)) {
                throw new Error('cannot create data directory "' + this.datadir_ + '" for application');
            }
        }        

        if (!fs.existsSync(this.contentdir_)) {
            throw new Error('cannot create content directory "' + this.contentdir_ + '" for application');
        }

        let host: string ;
        let user: string ;
        let passwd: string ;
        let port: number ;

        if (process.env.EMAILUSER !== undefined) {
            user = process.env.EMAILUSER!
        }
        else {
            throw new Error('the ".env" value EMAILUSER is not defined');
        }

        if (process.env.EMAILPASSWD !== undefined) {
            passwd = process.env.EMAILPASSWD!
        }
        else {
            throw new Error('the ".env" value EMAILPASSWD is not defined');
        }

        if (process.env.EMAILHOST !== undefined) {
            host = process.env.EMAILHOST!
        }
        else {
            throw new Error('the ".env" value EMAILHOST is not defined');
        }

        if (process.env.EMAILPORT !== undefined) {
            port = parseInt(process.env.EMAILPORT);
            if (isNaN(this.port_) || this.port_ <= 0 || this.port_ > 65535) {
                throw new Error('the ".env" value EMAILPORT is not valid - must be an integer greater than 0 and less than 65535') ;
            }
        }
        else {
            throw new Error('the ".env" value EMAILPORT is not defined');
        }

        this.email_ = new EmailConfig(user, passwd, host, port);
    }

    public dataDir() : string {
        return this.datadir_ ;
    }

    public contentDir() : string {
        return this.contentdir_ ;
    }

    public securityDir() : string {
        return this.securitydir_ ;
    }

    public logDir() : string {
        return this.logdir_ ;
    }

    public url() : string {
        return this.url_ ;
    }

    public port() : number {
        return this.port_ ;
    }

    public email() : EmailConfig {
        return this.email_ ;
    }

    public production() : boolean {
        return this.production_;
    }
}