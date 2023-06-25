export class User {
    id_: number ;
    username_ : string ;
    password_ : string ;
    lastname_ : string ;
    firstname_ : string ;
    email_ : string ;
    roles_ : string[];

    constructor(id: number, username: string, password: string, lastname: string, firstname: string, email: string, roles: string) {
        this.id_ = id ;
        this.username_ = username ;
        this.password_ = password ;
        this.lastname_ = lastname ;
        this.firstname_ = firstname ;
        this.email_ = email ;
        this.roles_ = roles.split(',');
    }
}