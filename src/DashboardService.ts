import path from "path";
import { Response, Request } from 'express';
import { DatabaseService } from "./DatabaseService";
import { xeroDBLoggerLog } from "./logger";
import { RobotService } from "./RobotService";
import { UserService } from "./UserService";
import { User } from "./User";
import { RobotPart } from "./RobotPart";

interface LooseObject {
    [key: string]: any
};

export class DashboardService extends DatabaseService {
    private static readonly userFileName: string = 'dashboard.db';

    private robots_ : RobotService ;
    private users_ : UserService ;

    constructor(rootdir: string, robots: RobotService, users: UserService) {
        super('audit', path.join(rootdir, DashboardService.userFileName));

        this.robots_  = robots ;
        this.users_ = users ;
    }

    protected createTables() {
        let sql =
            `CREATE TABLE dashboard (
                username text not null,
                robot int not null) ;
            ` ;
        this.db().exec(sql, (err) => {
            if (err) {
                let msg: string = this.name() + ": cannot create table 'dashboard' in RobotService";
                xeroDBLoggerLog('ERROR', msg);
                throw new Error(msg)
            }
        });
    }

    private async getDashboardRobot(u: User) : Promise<number | null> {
        let ret: Promise<number | null> = new Promise<number | null>(async (resolve, reject) => {
            let sql = "select username, robot from dashboard where username='" + u.username_ + "';" ;
            await this.db().all(sql, async (err, rows) => {
                if (!err) {
                    for (let row of rows) {
                        let obj: Object = row as Object;
                        type ObjectKey = keyof typeof obj;
                        const usernameKey = 'username' as ObjectKey;
                        const robotKey = 'robot' as ObjectKey;
                        
                        let robot: number = (obj[robotKey] as unknown) as number ;
                        resolve(robot) ;
                    }

                    resolve(null) ;
                }
                else {
                    reject(err.message);
                }
            });          
        }) ;
        return ret;
    }

    private async info(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        let ret: LooseObject = {} ;
        let robots: LooseObject[] = [] ;

        for (let [key, robot] of this.robots_.robots_) {
            let nrobot: LooseObject = {};
            nrobot['name'] = robot.name_;
            nrobot['id'] = robot.id_ ;
            nrobot['description'] = robot.description_;
            robots.push(nrobot);
        }
        ret.robots = robots ;

        try {
            let robot: number | null = await this.getDashboardRobot(u);

            if (robot !== null) {
                ret.robot = robot ;
            }
        }
        catch(err) {
            let errobj: Error = err as Error ;
            ret.error = errobj.message ;
        }
        
        res.json(ret);
    }

    private async summary(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        let ret: LooseObject = { summary: "This is a summary" } ;
        res.json(ret) ;
    }

    private async empty(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        let ret: LooseObject[] = [] ;
        res.json(ret) ;
    }

    private async late(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.query.robotid === undefined) {
            res.json(['invalid api REST request /robots/viewrobot - missing required parameters']) ;
            return;
        }

        let rid: number = parseInt(req.query.robotid, 10) ;
        if (isNaN(rid)) {
            res.json({error: 'invalid api REST request /robots/viewrobot - invalid robot id'}) ;
            return;            
        }

        let ret: LooseObject[] = [] ;
        let parts: RobotPart[] = await this.robots_.getPartsForRobot(rid);
        let current: Date = new Date() ;

        for(let one of parts) {
            let d: Date = new Date(one.donedate_) ;
            if (d < current) {
                let obj: LooseObject = this.robots_.partToLoose(u, one) ;
                ret.push(obj) ;
            }
            else {
                d = new Date(one.nextdate_) ;
                if (d < current) {
                    let obj: LooseObject = this.robots_.partToLoose(u, one) ;
                    ret.push(obj) ;
                }
            }
        }

        res.json(ret) ;
    }    

    private async setrobot(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.query.robotid === undefined) {
            res.json({ error: 'invalid api REST request /robots/viewrobot - missing required parameters' }) ;
            return;
        }

        let rid: number = parseInt(req.query.robotid, 10) ;
        if (isNaN(rid)) {
            res.json({error: 'invalid api REST request /robots/viewrobot - invalid robot id'}) ;
            return;            
        }

        let sql = "delete from dashboard where username='" + u.username_ + "'" ;
        this.db().exec(sql, (err) => {
            if (err) {
                let msg: string = this.name() + ": cannot create table 'dashboard' in RobotService";
                xeroDBLoggerLog('ERROR', msg);
                throw new Error(msg)
            }
            else {
                let sql = "insert into dashboard VALUES('" + u.username_ + "', " + rid + ");" ;
                this.db().exec(sql, (err) => {
                    if (err) {
                        let msg: string = this.name() + ": cannot create table 'dashboard' in RobotService";
                        xeroDBLoggerLog('ERROR', msg);
                        throw new Error(msg)
                    }
                });
            }
        });
    }    

    private async state(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.query.robotid === undefined) {
            res.json(['invalid api REST request /robots/viewrobot - missing required parameters']) ;
            return;
        }

        let rid: number = parseInt(req.query.robotid, 10) ;
        if (isNaN(rid)) {
            res.json({error: 'invalid api REST request /robots/viewrobot - invalid robot id'}) ;
            return;            
        }

        let ret: LooseObject[] = [] ;
        let parts: RobotPart[] = await this.robots_.getPartsForRobot(rid);
        let bystate: Map<string, LooseObject[]> = new Map<string, LooseObject[]>();

        for(let one of parts) {
            if (bystate.has(one.state_)) {
                bystate.get(one.state_)!.push(this.robots_.partToLoose(u, one)) ;
            }
            else {
                let objs: LooseObject[] = [] ;
                objs.push(this.robots_.partToLoose(u, one));
                bystate.set(one.state_, objs);
            }
        }

        for(let [state, robots] of bystate) {
            let topobj: LooseObject = {} ;
            topobj.title = state + " (" + robots.length + ")" ;
            topobj.children = robots ;
            ret.push(topobj);
        }

        res.json(ret) ;
    }        

    private async latechart(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.query.robotid === undefined) {
            res.json(['invalid api REST request /robots/viewrobot - missing required parameters']) ;
            return;
        }

        let rid: number = parseInt(req.query.robotid, 10) ;
        if (isNaN(rid)) {
            res.json({error: 'invalid api REST request /robots/viewrobot - invalid robot id'}) ;
            return;            
        }

        let ret: LooseObject[] = [] ;
        let parts: RobotPart[] = await this.robots_.getPartsForRobot(rid);
        let bystate: Map<string, LooseObject[]> = new Map<string, LooseObject[]>();

        ret = [
            { label: '1', value: 3 },
            { label: '9', value: 6 },
            { label: '?', value: 16}
        ] ;

        res.json(ret) ;
    }        

    public get(req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        xeroDBLoggerLog('DEBUG', "HistoryService: rest api '" + req.path + "'");

        console.log("dashboard: '" + req.path + "'");

        let u: User | null = this.users_.userFromRequest(req);
        if (u === null) {
            xeroDBLoggerLog('ERROR', "RobotService: rest api '" + req.path + "' with invalid user");
            let ret: LooseObject = {
                loggedin: false, 
                error: 'You are not logged into the system.' 
            } ;
            res.json(ret) ;
            return ;
        }

        let handled: boolean = false;

        if (req.path === '/dashboard/info') {
            this.info(u, req, res);
            handled = true ;
        }
        else if (req.path === '/dashboard/summary') {
            this.summary(u, req, res);
            handled = true ;
        }
        else if (req.path === '/dashboard/empty') {
            this.empty(u, req, res);
            handled = true ;
        }
        else if (req.path === '/dashboard/late') {
            this.late(u, req, res);
            handled = true ;
        }
        else if (req.path === '/dashboard/state') {
            this.state(u, req, res);
            handled = true ;
        }
        else if (req.path === '/dashboard/latechart') {
            this.latechart(u, req, res);
            handled = true ;
        }
        else if (req.path === '/dashboard/setrobot') {
            this.setrobot(u, req, res);
            handled = true ;
        }

        if (!handled) {
            let msg: string = 'unknown history REST API request "' + req.path + "'";
            let ret: LooseObject = { error: msg } ;
            res.json(ret) ;
        }
    }
}
