import { PartAttr } from "./PartAttr";
import { NextState, PartState } from "./PartState";
import { PartType } from "./PartType";
import { RobotService } from "./RobotService";

export class ManufacturedPartType extends PartType
{
    public static readonly manufacturing_types_ = [
        "By Hand",
        "Manual Mill",
        "Lathe",
        "Omio",
        "Velox",
        "CNC Mill",
        "EZTrak",
        "Glowforge",
        "3D Print"
    ] ;

    public static readonly material_types_ = [
        "Polycarbonate",
        "Aluminum",
        "Delrin",
        "PLA",
        "ABS",
        "Onyx"
    ]

    constructor() {
        let attrs: PartAttr[] =  [
            new PartAttr('Machine', PartAttr.TypeChoiceName, true, '').setChoices(ManufacturedPartType.manufacturing_types_),
            new PartAttr('Material', PartAttr.TypeChoiceName, true, '').setChoices(ManufacturedPartType.material_types_),
            new PartAttr('Dimension', PartAttr.TypeDoubleName, true, ''),
            new PartAttr(PartType.unitCostAttribute, PartAttr.TypeCurrencyName, false, '0.0')
        ];

        let flows: PartState[] = [
            new PartState(PartType.stateUnassigned, 
                [
                ]),
            new PartState(PartType.stateAssigned,
                [
                    new NextState(PartType.stateReadyForCAD, PartType.methodStudent),
                ]),          
            new PartState(PartType.stateReadyForCAD,
                [
                    new NextState(PartType.stateInCAD, PartType.methodAnyone),
                ]),      
            new PartState(PartType.stateInCAD,
                [
                    new NextState(PartType.stateReadyForDrawingCheck, PartType.methodAnyone),
                    new NextState(PartType.stateReadyForCAD, PartType.methodAnyone),
                ]),
            new PartState(PartType.stateReadyForDrawingCheck,
                [
                    new NextState(PartType.stateReadyForCAM, PartType.methodMentor),
                    new NextState(PartType.stateReadyForBuild, PartType.methodMentor),
                    new NextState(PartType.stateInCAD, PartType.methodAnyone),
                ]),
            new PartState(PartType.stateReadyForCAM,
                [
                    new NextState(PartType.stateInCAM, PartType.methodAnyone),
                ]),
            new PartState(PartType.stateInCAM,
                [
                    new NextState(PartType.stateReadyForCAM, PartType.methodAnyone),
                    new NextState(PartType.stateReadyForBuild, PartType.methodAnyone),
                ]),
            new PartState(PartType.stateReadyForBuild,
                [
                    new NextState(PartType.stateInBuild, PartType.methodAnyone),
                    new NextState(PartType.stateInCAD, PartType.methodAnyone),
                    new NextState(PartType.stateInCAM, PartType.methodAnyone),
                ]),
            new PartState(PartType.stateInBuild,
                [
                    new NextState(PartType.stateReadyForBuildCheck, PartType.methodAnyone),
                ]),
            new PartState(PartType.stateReadyForBuildCheck,
                [
                    new NextState(PartType.stateDone, PartType.methodMentor),
                ]),
        ] ;

        super('M', '/nologin/images/file.png', 'Manufactured', false, attrs, flows);
    }
}