import { PartAttr } from "./PartAttr";
import { NextState, PartState } from "./PartState";
import { PartType } from "./PartType";
import { RobotService } from "./RobotService";

export class AssemblyPartType extends PartType
{
    constructor() {
        let attrs: PartAttr[] =  [
        ];

        let flows: PartState[] = [
            new PartState(PartType.stateUnassigned, 
                [
                    // System will transition when both student and mentor are assigned                
                ]),
            new PartState(PartType.stateAssigned,
                [
                    new NextState(PartType.stateWaitingForParts, PartType.methodStudent),
                ]),
            new PartState(PartType.stateWaitingForParts,
                [
                    // System will transition to ReadyForAssembly when all child parts are 'Done'
                ]),
            new PartState(PartType.stateReadyForAssembly,
                [
                    new NextState(PartType.stateInAssembly, PartType.methodStudent),
                ]),
            new PartState(PartType.stateInAssembly,
                [
                    new NextState(PartType.stateReadyForMentorCheck, PartType.methodStudent),
                ]),
            new PartState(PartType.stateReadyForMentorCheck,
                [
                    new NextState(PartType.stateWaitingForParts, PartType.methodMentor),
                    new NextState(PartType.stateReadyForAssembly, PartType.methodMentor),
                    new NextState(PartType.stateInAssembly, PartType.methodAnyone),
                    new NextState(PartType.stateDone, PartType.methodMentor),
                ]),
            new PartState(PartType.stateDone,
                [
                    new NextState(PartType.stateWaitingForParts, PartType.methodMentor),
                    new NextState(PartType.stateReadyForAssembly, PartType.methodMentor),
                    new NextState(PartType.stateInAssembly, PartType.methodMentor),
                ]),
        ] ;

        super('A', '/nologin/images/empty.png', 'Assembly', true, attrs, flows);
    }
}