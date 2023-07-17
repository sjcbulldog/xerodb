import path from "path";
import { Response, Request } from 'express';
import { DatabaseService } from "./DatabaseService";
import { xeroDBLoggerLog } from "./logger";
import { RobotService } from "./RobotService";
import { UserService } from "./UserService";
import { User } from "./User";
import { RobotPart } from "./RobotPart";
import { PartNumber } from "./PartNumber";
import { OneInstance, PartOrder } from "./PartOrder";

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

        for (let robot of this.robots_.getRobots()) {
            let nrobot: LooseObject = {};
            nrobot['name'] = robot.name_;
            nrobot['id'] = robot.id_ ;
            nrobot['description'] = robot.description_;
            robots.push(nrobot);
        }
        ret.robots = robots ;
        ret.username = u.username_ ;

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
            if (one.state_ === RobotService.stateDone)
                continue ;
                
            if (one.doneDaysLate() > 0) {
                let obj: LooseObject = this.robots_.partToLoose(u, one) ;
                ret.push(obj) ;
            }
            else if (one.nextDaysLate() > 0) {
                let obj: LooseObject = this.robots_.partToLoose(u, one) ;
                ret.push(obj) ;
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

        let user: boolean = false ;
        if (req.query.user && req.query.user === 'true') {
            user = true ;
        }

        let ret: LooseObject[] = [] ;
        let parts: RobotPart[] = await this.robots_.getPartsForRobot(rid);
        let bystate: Map<string, LooseObject[]> = new Map<string, LooseObject[]>();

        for(let one of parts) {
            if (user === true && one.student_ != u.username_ && one.mentor_ != u.username_)
                continue ;

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

        let type: string = 'next' ;
        if (req.query.type !== undefined)
            type = req.query.type ;

        let ret: LooseObject[] = [] ;
        let parts: RobotPart[] = await this.robots_.getPartsForRobot(rid);
        let bystate: Map<string, LooseObject[]> = new Map<string, LooseObject[]>();

        // 0, 1, 3, 5, 10, 10+
        let buckets: number[] = [0, 0, 0, 0, 0, 0]
        for(let one of parts) {
            let dlate: number ;
            
            if (type === 'next')
                dlate = one.nextDaysLate() ;
            else
                dlate = one.doneDaysLate() ;
                
            if (dlate === 0) {
                buckets[0]++ ;
            }
            else if (dlate <= 1) {
                buckets[1]++
            }
            else if (dlate <= 3) {
                buckets[2]++ ;
            }
            else if (dlate <= 5) {
                buckets[3]++ ;
            }
            else if (dlate <= 10) {
                buckets[4]++ ;
            }
            else {
                buckets[5]++ ;
            }
        }

        ret = [
            { label: 'On Time', value: buckets[0] },
            { label: '<= 1 day', value: buckets[1] },
            { label: '<= 3 days', value: buckets[2]},
            { label: '<= 5 days', value: buckets[3]},
            { label: '<= 10 days', value: buckets[4]},
            { label: '> 10 days', value: buckets[5]},
        ] ;

        res.json(ret) ;
    }        

    private async latereport(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.query.robotid === undefined) {
            res.json(['invalid api REST request /robots/viewrobot - missing required parameters']) ;
            return;
        }

        let rid: number = parseInt(req.query.robotid, 10) ;
        if (isNaN(rid)) {
            res.json({error: 'invalid api REST request /robots/viewrobot - invalid robot id'}) ;
            return;            
        }

        let type: string = 'next' ;
        if (req.query.type !== undefined)
            type = req.query.type ;

        let ret: LooseObject[] = [] ;
        let parts: RobotPart[] = await this.robots_.getPartsForRobot(rid);
        let bystate: Map<string, LooseObject[]> = new Map<string, LooseObject[]>();

        // 0, 1, 3, 5, 10, 10+
        let b0: LooseObject[] = [] ;
        let b1: LooseObject[] = [] ;
        let b2: LooseObject[] = [] ;
        let b3: LooseObject[] = [] ;
        let b4: LooseObject[] = [] ;
        let b5: LooseObject[] = [] ;

        for(let one of parts) {
            let dlate: number ;
            
            if (type === 'next')
                dlate = one.nextDaysLate() ;
            else
                dlate = one.doneDaysLate() ;
                
            if (dlate === 0) {
                b0.push(this.robots_.partToLoose(u, one)) ;
            }
            else if (dlate <= 1) {
                b1.push(this.robots_.partToLoose(u, one)) ;
            }
            else if (dlate <= 3) {
                b2.push(this.robots_.partToLoose(u, one)) ;
            }
            else if (dlate <= 5) {
                b3.push(this.robots_.partToLoose(u, one)) ;
            }
            else if (dlate <= 10) {
                b4.push(this.robots_.partToLoose(u, one)) ;
            }
            else {
                b5.push(this.robots_.partToLoose(u, one)) ;
            }
        }

        ret = [
            { title: 'On Time (' + b0.length + ')', children: b0 },
            { title: '<= 1 day (' + b1.length + ')', children: b1 },
            { title: '<= 3 days (' + b2.length + ')', children: b2},
            { title: '<= 5 days (' + b3.length + ')', children: b3},
            { title: '<= 10 days (' + b4.length + ')', children: b4},
            { title: '> 10 days (' + b5.length + ')', children: b5},
        ] ;

        res.json(ret) ;
    }          

    private descend(part: RobotPart, quantity: number, path: string[], total: Map<string, PartOrder>, parts: RobotPart[]) {
        if (part.type_ === RobotService.partTypeCOTS && part.state_ === RobotService.stateReadyToOrder) {
            if (part.attribs_.get(RobotService.unitCostAttribute)) {
                let partpath: string[] = [...path, part.part_.toString()] ;
                let cost: number = 0.0 ;
                let coststr: string | undefined = part.attribs_.get(RobotService.unitCostAttribute) ;
                cost = parseFloat(coststr!);
                let oneinst = new OneInstance(partpath, quantity, cost);

                if (total.has(part.description_)) {
                    let opart: PartOrder | undefined = total.get(part.description_);
                    opart!.addInstance(oneinst);
                }
                else {
                    let opart: PartOrder = new PartOrder(part.description_) ;
                    opart.addInstance(oneinst) ;
                    total.set(part.description_, opart);
                }
            }
        }
        else if (part.type_ === RobotService.partTypeAssembly) {
            for(let one of parts) {
                if (one.isChildOf(part.part_)) {
                    let partpath : string[] = [...path, one.part_.toString()] ;
                    this.descend(one, quantity * one.quantity_, partpath, total, parts);
                }
            }
        }
    }

    private async order(u: User, req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        if (req.query.robotid === undefined) {
            res.json(['invalid api REST request /robots/viewrobot - missing required parameters']) ;
            return;
        }

        let rid: number = parseInt(req.query.robotid, 10) ;
        if (isNaN(rid)) {
            res.json({error: 'invalid api REST request /robots/viewrobot - invalid robot id'}) ;
            return;            
        }

        let type: string = 'next' ;
        if (req.query.type !== undefined)
            type = req.query.type ;

        let parts: RobotPart[] = await this.robots_.getPartsForRobot(rid);
        let total: Map<string, PartOrder> = new Map<string, PartOrder>();
        let p: RobotPart | null = RobotService.findPartById(new PartNumber(rid, 'COMP', 1), parts) ;
        if (p !== null) {
            let path: string[] = [ p.part_.toString() ] ;
            this.descend(p, 1, path, total, parts);
        }

        p = RobotService.findPartById(new PartNumber(rid, 'PRAC', 1), parts) ;
        if (p !== null) {
            let path: string[] = [ p.part_.toString() ] ;
            this.descend(p, 1, path, total, parts);
        }

        let ret: LooseObject[] = [] ;

        for (let [key, value] of total) {
            let obj: LooseObject = { 
                title: key,
                quantity: value.totalQuantity(),
                cost: value.cost() * value.totalQuantity(),
            };

            let childs: LooseObject[] = [] ;
            for(let inst of value.instances_) {
                let childobj : LooseObject = {
                    title: inst.path_.toString().replace(',', '/'),
                    quantity: '',
                    cost: '',
                } ;
                childs.push(childobj);
            }

            if (childs.length > 0) {
                obj.children = childs ;
            }

            ret.push(obj);
        }

        res.json(ret);
    }

    public get(req: Request<{}, any, any, any, Record<string, any>>, res: Response<any, Record<string, any>>) {
        xeroDBLoggerLog('DEBUG', "DashboardService: rest api '" + req.path + "'");

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
        else if (req.path === '/dashboard/latereport') {
            this.latereport(u, req, res);
            handled = true ;
        }
        else if (req.path === '/dashboard/setrobot') {
            this.setrobot(u, req, res);
            handled = true ;
        } 
        else if (req.path === '/dashboard/order') {
            this.order(u, req, res) ;
            handled = true ;
        }

        if (!handled) {
            let msg: string = 'unknown history REST API request "' + req.path + "'";
            let ret: LooseObject = { error: msg } ;
            res.json(ret) ;
        }
    }
}
