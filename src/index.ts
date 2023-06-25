import express, { Express, Request, Response } from 'express' ;
import dotenv from 'dotenv' ;
import { UserService } from './UserService' ;
import { User } from './User' ;
import bodyParser from 'body-parser' ;

dotenv.config() ;

const usersrv: UserService = new UserService(process.env.ROOTDIR!);
const app: Express = express() ;
const port = process.env.PORT ;

app.use(express.static('public'));
app.use(express.json());
app.use(bodyParser.urlencoded());
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.redirect('login.html') ;
});

function createError(errmsg: string) : string {
  let ret: string = "<!DOCTYPE html><head><title>Error</title></head>";
  ret += "<body><h1>" + errmsg + "</h1></body>" ;

  return ret;
}

app.post('/users/register', (req, res) => {
  let roles: string[] = [] ;
  let ret = usersrv.addUser(req.body.username, req.body.password, req.body.lastname, req.body.firstname, req.body.email, null, roles) ;
  if (ret == null) {
    res.redirect('/pending.html');
  }
  else {
    res.send(createError(ret.message))
  }
}) ;

app.post('/users/login', (req, res) => {
  let u : User | Error = usersrv.canUserLogin(req.body.username, req.body.password);
  if (u instanceof User) {
    if (u.isAdmin()) {
      res.redirect('/menuadmin.html')
    }
  }
  else {
    let err: Error = u as Error ;
    if (err.message == UserService.UserNotActiveError) {
      let msg: string = 'the user "' + req.body.username + '" is not active - see a mentor for more details' ;
      res.send(createError(msg));
    }
    else {
      let msg: string = 'the user or password given are not valid' ;
      res.send(createError(msg));
    }
  }
}) ;

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
