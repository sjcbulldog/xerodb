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
          </section>
        </div>
      </body>
  `
  ret = ret.replace('$$$MESSAGE$$$', msg);
  return ret;
}
