export class User {
    public static readonly AdminRoleName = "admin" ;

    id_: number ;
    username_ : string ;
    password_ : string ;
    lastname_ : string ;
    firstname_ : string ;
    email_ : string ;
    state_ : string ;
    roles_ : string[];
    cookie_ : string ;

    constructor(id: number, username: string, password: string, lastname: string, firstname: string, email: string, state: string, roles: string[]) {
        this.id_ = id ;
        this.username_ = username ;
        this.password_ = password ;
        this.lastname_ = lastname ;
        this.firstname_ = firstname ;
        this.email_ = email ;
        this.state_ = state ;
        this.roles_ = roles;
        this.cookie_ = "" ;
    }

    public isAdmin() : boolean {
        let ret: boolean = false ;

        for(let role of this.roles_) {
            if (role === User.AdminRoleName) {
                ret = true ;
                break ;
            }
        }

        return ret ;
    }

    public isRole(desired: string) : boolean {
        let ret: boolean = false ;

        for(let role of this.roles_) {
            if (role === desired) {
                ret = true ;
                break ;
            }
        }

        return ret ;
    }
}