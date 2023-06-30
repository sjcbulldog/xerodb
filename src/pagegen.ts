import path from "path";
import { XeroDBConfig } from './config' ;
import * as fs from 'fs' ;

let config: XeroDBConfig = XeroDBConfig.getXeroDBConfig();

export function createMessageHtml(title: string, msg: string) : string {
  let ret: string = 
    ` <!DOCTYPE html>
      <head>
        <title>$$$TITLE$$$</title>
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
  ret = ret.replace('$$$TITLE$$$', title);
  ret = ret.replace('$$$MESSAGE$$$', msg);
  return ret;
}

export function processPage(vars: Map<string, string> | null, page: string) : string {
  let ret: string ;

  page = path.join(config.contentDir(), page);
  ret = fs.readFileSync(page).toString('utf-8');

  if (vars !== null) {
    for(let [key, text] of vars) {
      ret = ret.replace(key, text);
    }
  }

  return ret ;
}