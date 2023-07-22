import { PartAttr } from "./PartAttr";
import { NextState, PartState } from "./PartState";
import { PartType } from "./PartType";
import { RobotService } from "./RobotService";

export class COTSPartType extends PartType
{
    constructor() {
        let attrs: PartAttr[] =  [
            new PartAttr('Vendor Name', PartAttr.TypeStringName, true, ''),
            new PartAttr('Vendor Site', PartAttr.TypeStringName, true, ''),
            new PartAttr('Vendor Part Number', PartAttr.TypeStringName, false, ''),
            new PartAttr(PartType.unitCostAttribute, PartAttr.TypeCurrencyName, false, '0.0'),
        ];

        let flows: PartState[] = [
            new PartState(PartType.stateUnassigned, 
                [
                    // System will transition when both student and mentor are assigned
                ]),
            new PartState(PartType.stateAssigned, 
                [
                    new NextState(PartType.stateReadyToOrder, PartType.methodStudent),
                    new NextState(PartType.stateOrdered, PartType.methodMentor),
                    new NextState(PartType.stateDone, PartType.methodAnyone),
                ]),
            new PartState(PartType.stateReadyToOrder,
                [
                    new NextState(PartType.stateOrdered, PartType.methodMentor),
                    new NextState(PartType.stateDone, PartType.methodAnyone)
                ]),
            new PartState(PartType.stateOrdered,
                [
                    new NextState(PartType.stateDone, PartType.methodAnyone),
                    new NextState(PartType.stateAssigned, PartType.methodMentor),
                    new NextState(PartType.stateReadyToOrder, PartType.methodMentor)
                ]),
            new PartState(PartType.stateDone,
                [
                    new NextState(PartType.stateAssigned, PartType.methodMentor),
                    new NextState(PartType.stateOrdered, PartType.methodMentor),
                    new NextState(PartType.stateReadyToOrder, PartType.methodMentor)
                ]),
        ] ;

        super('C', '/nologin/images/file.png', 'COTS', false, attrs, flows);
    }
}