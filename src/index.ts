import express, { Express, Request, Response } from 'express';
import morgan from 'morgan';
import { UserService } from './UserService';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import path from 'path';
import { isLoggedIn, isAdmin } from './auth';
import { XeroDBConfig } from './config';
import { User } from './User';
import { createMessageHtml, processPage } from './pagegen';
import https from 'https';
import fs from 'fs';
import { RobotService } from './RobotService';
import * as FileStreamRotator from 'file-stream-rotator';
import FileUpload from 'express-fileupload';
import { xeroDBLoggerInit, xeroDBLoggerLog } from './logger';
import { AuditService } from './AuditService';
import { DashboardService } from './DashboardService';
import { DrawingsService } from './DrawingsService';
import { DatabaseService } from './DatabaseService';

const nologinName: string = "/nologin/*";
const adminName: string = "/admin/*";
const normalName: string = "/normal/*";

const useDashboard: boolean = true ;

const config: XeroDBConfig = XeroDBConfig.getXeroDBConfig();
var logStream = FileStreamRotator.getStream({
  filename: path.join(config.logDir(), "xerodb-log-%DATE%"),
  frequency: "daily",
  date_format: "YYYY-MM-DD",
  size: "100M",
  max_logs: "100",
  audit_file: path.join(config.logDir(), "audit.json"),
  extension: ".log",
  create_symlink: true,
  symlink_name: "tail-current.log",
});
xeroDBLoggerInit(logStream);

DatabaseService.createOrOpenVersionDB(config.dataDir())
  .then((status: boolean) => {

    const auditsrv: AuditService = new AuditService(config.dataDir());
    const usersrv: UserService = new UserService(config.dataDir(), auditsrv);
    const robotsrv: RobotService = new RobotService(config.dataDir(),usersrv, auditsrv);
    const dashboardsrv: DashboardService = new DashboardService(config.dataDir(), robotsrv, usersrv) ;
    const drawingssrv: DrawingsService = new DrawingsService(config.dataDir(), robotsrv, usersrv);
    
    const app: Express = express();
    app.disable('etag');
    app.use(morgan('combined', { stream: logStream }));
    app.use(express.json());
    app.use(bodyParser.urlencoded( { extended: true}));
    app.use(cookieParser());
    app.use(FileUpload({ createParentPath: true}));
    
    app.get(nologinName, (req, res, next) => {
      let urlpath: string = req.url.substring(nologinName.length - 1);
      let filepath: string = path.join(config.contentDir(), 'nologin', urlpath);
      let b: string = path.basename(filepath);
      res.contentType(b);
      res.sendFile(filepath);
    });
    
    app.get(adminName, (req, res) => {
    
      if (!isAdmin(usersrv, req, res)) {
        res.send(createMessageHtml('Permission Denied', 'You do not have permission for this command', null));
      }
      else {
        let urlpath: string = req.url.substring(adminName.length - 1);
        let filepath: string = path.join(config.contentDir(), 'admin', urlpath);
        res.contentType(path.basename(filepath));
        res.sendFile(filepath);
      }
    });
    
    app.get(normalName, (req, res, next) => {
      if (!isLoggedIn(req, res)) {
        res.status(403).send(createMessageHtml('Permission Denied', 'You cannot access the requested resource when you are not logged in'));
      }
      else {
        let urlpath: string = req.url.substring(normalName.length - 1);
        let filepath: string = path.join(config.contentDir(), 'normal', urlpath);
        res.contentType(path.basename(filepath));
        res.sendFile(filepath);
      }
    });
    
    app.all('/', (req, res) => {
      res.redirect('/nologin/login.html');
    });
    
    app.all('/users/*', (req, res) => {
      try {
        usersrv.get(req, res);
      }
      catch (err) {
        let errobj: Error = err as Error;
    
        if (errobj !== undefined) {
          if (errobj.stack !== undefined) {
            xeroDBLoggerLog('DEBUG', errobj.stack.toString());
          }
        }
        xeroDBLoggerLog('ERROR', 'exception caught for URL "' + req.url + '"');
        res.status(500).send(createMessageHtml('Internal Error', 'internal error - exception thrown - check log file'));
      }
    });
    
    app.all('/robots/*', (req, res) => {
      try {
        robotsrv.get(req, res);
      }
      catch (err) {
        let errobj: Error = err as Error;
    
        if (errobj !== undefined) {
          if (errobj.stack !== undefined) {
            xeroDBLoggerLog('DEBUG', errobj.stack.toString());
          }
        }
        xeroDBLoggerLog('ERROR', 'exception caught for URL "' + req.url + '"');
        res.status(500).send(createMessageHtml('Internal Error', 'internal error - exception thrown - check log file'));
      }
    });
    
    app.all('/audit/*', (req, res) => {
      try {
        auditsrv.get(req, res);
      }
      catch (err) {
        let errobj: Error = err as Error;
    
        if (errobj !== undefined) {
          if (errobj.stack !== undefined) {
            xeroDBLoggerLog('DEBUG', errobj.stack.toString());
          }
        }
        xeroDBLoggerLog('ERROR', 'exception caught for URL "' + req.url + '"');
        res.status(500).send(createMessageHtml('Internal Error', 'internal error - exception thrown - check log file'));
      }
    });
    
    app.all('/dashboard/*', (req, res) => {
        try {
          dashboardsrv.get(req, res);
        }
        catch (err) {
          let errobj: Error = err as Error;
      
          if (errobj !== undefined) {
            if (errobj.stack !== undefined) {
              xeroDBLoggerLog('DEBUG', errobj.stack.toString());
            }
          }
          xeroDBLoggerLog('ERROR', 'exception caught for URL "' + req.url + '"');
          res.status(500).send(createMessageHtml('Internal Error', 'internal error - exception thrown - check log file'));
        }
    });
    
    app.all('/drawings/*', (req, res) => {
        try {
          drawingssrv.get(req, res);
        }
        catch (err) {
          let errobj: Error = err as Error;
      
          if (errobj !== undefined) {
            if (errobj.stack !== undefined) {
              xeroDBLoggerLog('DEBUG', errobj.stack.toString());
            }
          }
          xeroDBLoggerLog('ERROR', 'exception caught for URL "' + req.url + '"');
          res.status(500).send(createMessageHtml('Internal Error', 'internal error - exception thrown - check log file'));
        }
    });
    
    app.all('/menu', (req, res) => {
      if (useDashboard) {
        res.redirect('/normal/dashboard.html') ;
      }
      else {
        try {
          let u: User | null = usersrv.userFromRequest(req);
          if (u === null) {
            res.redirect('/');
          }
          else if (u.isAdmin()) {
            res.redirect('/admin/menu.html');
          }
          else {
            res.redirect('/normal/menu.html');
          }
        }
        catch (err) {
          let errobj: Error = err as Error;
    
          if (errobj !== undefined) {
            if (errobj.stack !== undefined) {
              xeroDBLoggerLog('DEBUG', errobj.stack.toString());
            }
          }
          xeroDBLoggerLog('ERROR', 'exception caught for URL "' + req.url + '"');
          res.status(500).send(createMessageHtml('Internal Error', 'internal error - exception thrown - check log file'));
        }
      }
    }) ;
    
    if (config.production()) {
      if (config.useTLS()) {
        var privateKey = fs.readFileSync(path.join(config.securityDir(), 'server.key'), 'utf8');
        var certificate = fs.readFileSync(path.join(config.securityDir(), 'server.crt'), 'utf8');
        var credentials = { key: privateKey, cert: certificate };
    
        https.createServer(credentials, app).listen(config.port(), '0.0.0.0', 16, () => {
          xeroDBLoggerLog('INFO', `xerodb: production server w/ TLS is running at "${config.url()}" on port ${config.port()}`);
        });
      }
      else {
        app.listen(config.port(), '0.0.0.0', 16, () => {
          xeroDBLoggerLog('INFO', `xerodb: production server without TLS is running at "${config.url()}" on port ${config.port()}`);
        });    
      }
    }
    else {
      app.listen(config.port(), '127.0.0.1', 16, () => {
        xeroDBLoggerLog('INFO', `xerodb: development server is running at "${config.url()}" on port ${config.port()}`);
      });
    }
    
  })
  .catch((err) => {

  }) ;

