import path from "path";
import { User } from "./User";
import { XeroDBConfig } from './config' ;
import * as fs from 'fs' ;

let config: XeroDBConfig = XeroDBConfig.getXeroDBConfig();

export function createMessageHtml(msg: string) : string {
  let ret: string = 
    ` <!DOCTYPE html>
      <head>
        <title>Error</title>
        <link rel="stylesheet" href="/nologin/message.css">
      </head>
      <body>
        <div class="container">
          <section id="content">
            <p>$$$MESSAGE$$$</p>
            <p></p>
            <p></p>
            <a href="/menu">Return to menu</a>
          </section>
        </div>
      </body>
  `
  ret = ret.replace('$$$MESSAGE$$$', msg);
  return ret;
}

export function processPage(u: User, page: string) : string {
  let ret: string ;

  page = path.join(config.contentDir(), page);
  ret = fs.readFileSync(page).toString('utf-8');
  ret = ret.replace('$$$USERNAME$$$',u.username_);
  ret = ret.replace('$$$USEREMAIL$$$', u.email_);
  return ret ;
}