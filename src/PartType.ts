import { PartAttr } from "./PartAttr";
import { PartState } from "./PartState";

export abstract class PartType {

    public static readonly methodStudent = "student" ;
    public static readonly methodMentor = "mentor" ;
    public static readonly methodAnyone = "anyone" ;
    public static readonly methodAssignedStudent = "assigned-student" ;
    public static readonly methodAssignedMentor = "assigned-mentor" ;

    public static readonly unitCostAttribute = 'Unit Cost' ;

    public static readonly stateUnassigned: string = "Unassigned" ;
    public static readonly stateAssigned: string = "Assigned" ;
    public static readonly stateReadyToOrder: string = "Ready To Order" ;
    public static readonly stateOrdered: string = "Ordered" ;
    public static readonly stateWaitingForParts: string = "Waiting For Parts" ;
    public static readonly stateReadyForAssembly: string = "Ready For Assembly" ;
    public static readonly stateInAssembly: string = "In Assembly" ;
    public static readonly stateReadyForMentorCheck: string = "Ready For Mentor Check"
    public static readonly stateReadyForCAD: string = "Ready For CAD" ;
    public static readonly stateInCAD: string = "In CAD" ;
    public static readonly stateReadyForDrawingCheck: string = "Ready For Drawing Check" ;
    public static readonly stateReadyForCAM: string = "Ready For CAM" ;
    public static readonly stateInCAM: string = "In CAM" ;
    public static readonly stateReadyForBuild: string = "Ready For Build" ;
    public static readonly stateInBuild: string = "In Build" ;
    public static readonly stateReadyForBuildCheck: string = "Ready For Build Check" ;    
    public static readonly stateDone: string = "Done" ;

    public readonly attributes: PartAttr[] ;
    public readonly flow : PartState[] ;
    public readonly typech: string ;
    public readonly icon: string ;
    public readonly fullTypeName: string ;
    public readonly canHaveChildren: boolean ;

    constructor(ch: string, icon: string, fullTypeName: string, canHaveChildren: boolean, attrs: PartAttr[], flow: PartState[]) {
        this.typech = ch ;
        this.icon = icon ;
        this.fullTypeName = fullTypeName;
        this.attributes = attrs ;
        this.flow = flow ;
        this.canHaveChildren = canHaveChildren ;
    }
}