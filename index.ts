import express, { Express, Request, Response } from 'express' ;
import dotenv from 'dotenv' ;
import { UserService } from './UserService' ;

dotenv.config() ;

const usersrv: UserService = new UserService(process.env.ROOTDIR!);
const app: Express = express() ;
const port = process.env.PORT ;

app.get('/', (req, res) => {
  res.redirect('login.html') ;
});

app.get('/users/login', (req, res) => {

}) ;

app.use(express.static('public'));

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
