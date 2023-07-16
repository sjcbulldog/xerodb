import path from "path";
import { XeroDBConfig } from './config' ;
import * as fs from 'fs' ;

let config: XeroDBConfig = XeroDBConfig.getXeroDBConfig();

export function createMessageHtml(title: string, msg: string, next?: string | undefined | null) : string {
  let nextpage: string ;
  if (next) {
    nextpage = next ;
  }
  else {
    nextpage = `<a href="/menu">Return to menu</a>`;
  }
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
            ` ;
    if (next !== null) {
        ret += nextpage ;
    }

    ret += `</section>
        </div>
        </body>`
        
  ret = ret.replace('$$$TITLE$$$', title);
  ret = ret.replace('$$$MESSAGE$$$', msg);
  return ret;
}

function replaceKey(input: string, key: string, text: string) : string {
    let retstr: string = input ;

    while (true) {
        let match: number = retstr.indexOf(key) ;
        if (match === -1)
            break ;

        retstr = retstr.substring(0, match) + text + retstr.substring(match + key.length);
    }

    return retstr ;
}

export function processPage(vars: Map<string, string> | null, page: string) : string {
  let ret: string ;

  page = path.join(config.contentDir(), page);
  ret = fs.readFileSync(page).toString('utf-8');

  if (vars !== null) {
    for(let [key, text] of vars) {
        ret = replaceKey(ret, key, text);
    }
  }

  return ret ;
}