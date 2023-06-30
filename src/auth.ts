import { Response, Request } from 'express' ;
import { createMessageHtml } from './pagegen';
import { UserService } from './UserService' ;
import { User } from './User';

export function isLoggedIn(req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) : boolean {

    if (req.cookies.xeropartdb === undefined) {
        res.status(403).send(createMessageHtml('Error', 'you are not logged in - 1!'));
        return false ;
    }

    return true ;
}

export function isAdmin(usersrv: UserService, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) : boolean {
    if (!isLoggedIn(req, res)) {
        return false ;
    }

    // Check cookie to user
    let u: User | null = usersrv.userFromCookie(req.cookies.xeropartdb);
    if (u === null) {
      return false ;
    }
    else if (!u!.isAdmin()) {
      return false ;
    }

    return true ;
}