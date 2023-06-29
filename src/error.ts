
export function createErrorPage(errmsg: string) : string {
    let ret: string = "<!DOCTYPE html><head><title>Error</title></head>";
    ret += "<body><h1>" + errmsg + "</h1></body>" ;
    return ret;
  }