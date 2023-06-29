import express, { Express, Request, Response } from 'express' ;
import dotenv from 'dotenv' ;
import { UserService } from './UserService' ;
import bodyParser from 'body-parser' ;
import cookieParser from 'cookie-parser';
import path from 'path';
import { isLoggedIn, isAdmin } from './auth';

const nologinName: string = "/nologin/*" ;
const adminName: string = "/admin/*" ;
const normalName: string = "/normal/*" ;

dotenv.config() ;

const usersrv: UserService = new UserService(process.env.DATADIR!);
const app: Express = express() ;

app.use(express.json());
app.use(bodyParser.urlencoded());
app.use(bodyParser.json());
app.use(cookieParser());

app.get(nologinName, (req, res, next) => {
  let urlpath: string = req.url.substring(nologinName.length - 1);
  let filepath: string = path.join(process.env.CONTENTDIR!, 'nologin', urlpath);
  let b: string = path.basename(filepath) ;
  res.contentType(b) ;
  res.sendFile(filepath);
}) ;

app.get(adminName, (req, res) => {

  if (!isAdmin(usersrv, req, res))
    return ;

  let urlpath: string = req.url.substring(adminName.length - 1);
  let filepath: string = path.join(process.env.CONTENTDIR!, 'admin', urlpath);
  res.contentType(path.basename(filepath));
  res.sendFile(filepath);
}) ;

app.get(normalName, (req, res, next) => {
  if (!isLoggedIn(req, res))
    return false ;

  let urlpath: string = req.url.substring(normalName.length - 1);
  let filepath: string = path.join(process.env.CONTENTDIR!, 'normal', urlpath);
  res.contentType(path.basename(filepath));
  res.sendFile(filepath);
}) ;

app.all('/', (req, res) => {
  res.redirect('/nologin/login.html');
});

app.all('/users/*', (req, res) => {
  usersrv.get(req, res) ;
});

let port: number = +process.env.PORT! ;
app.listen(port, '0.0.0.0', 16, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
