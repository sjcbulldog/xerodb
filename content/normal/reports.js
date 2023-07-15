const noRobotSelected = '-- No Robot Selected --';
var robotid = undefined ;
var reportdesc = undefined ;

const reports = [
    {
        name: "Parts By State",
        url: "/dashboard/state?",
        columns: [
            { id: "*", title: "Part", width: "300px" },
            { id: "student", title: "Student", width: "120px" },
            { id: "mentor", title: "Mentor", width: "120px" },
            { id: "nextdate", title: "Next Date", width: "120px" },
            { id: "desc", title: "Description" }
        ]
    },
    {
        name: "Parts By Days Late (next state)",
        url: "/dashboard/latereport?type=next&",
        columns: [
            { id: "*", title: "Part", width: "300px" },
            { id: "student", title: "Student", width: "120px" },
            { id: "mentor", title: "Mentor", width: "120px" },
            { id: "nextdate", title: "Next Date", width: "120px" },
            { id: "desc", title: "Description" }
        ]
    },
    {
        name: "Parts By Days Late (done)",
        url: "/dashboard/latereport?type=done&",
        columns: [
            { id: "*", title: "Part", width: "300px" },
            { id: "student", title: "Student", width: "120px" },
            { id: "mentor", title: "Mentor", width: "120px" },
            { id: "donedate", title: "Done Date", width: "120px" },
            { id: "desc", title: "Description" }
        ]
    },
    {
        name: "Parts To Order",
        url: "/dashboard/order?",
        columns: [
            { id: "*", title: "Part", width: "300px" },
            { id: "student", title: "Student", width: "120px" },
            { id: "mentor", title: "Mentor", width: "120px" },
            { id: "donedate", title: "Done Date", width: "120px" },
            { id: "desc", title: "Description" }
        ]
    }
]

function tellUser(error, msg) {
    alert(msg);
}

function tellLogin() {
    alert('You are not logged in.');
    window.parent.location.href = '/nologin/login.html';
}

function getRobotName(robots, id) {
    for (let one of robots) {
        if (one.id === id) {
            return one.name;
        }
    }

    return '';
}

function createReport() {
    $('#report').replaceWith("<div id='report' style='height: 94vh'></div>");

    let reporturl = reportdesc.url + 'robotid=' + robotid;

    latetree = new mar10.Wunderbaum({
        id: "report",
        element: document.getElementById("report"),
        source: {
            url: reporturl
        },
        columns: reportdesc.columns,
        render: function (e) {
            const node = e.node;
            node.tooltip = node.data.desc;
            for (const col of Object.values(e.renderColInfosById)) {
                col.elem.textContent = node.data[col.id];
            }
        },
        enhanceTitle: function (e) {
            e.titleSpan.title = e.node.data.desc;
        },
        dblclick: function (e) {
            if (/^[0-9][0-9][0-9]-[A-Za-z]+-[0-9][0-9][0-9][0-9][0-9]$/.test(e.node.key)) {
                window.location.href = "/robots/editpart?partno=" + e.node.key + "&parttype=" + e.node.data.ntype + "&retplace=/normal/dashdef.html";
            }
        },
    });
}

function robotSelected(sel) {
    if (sel.selectedOptions.length === 1) {
        let opt = sel.selectedOptions[0];
        robotid = opt.robotID ;
        createReport();
    }
}

function reportSelected(sel) {
    if (sel.selectedOptions.length === 1) {
        let opt = sel.selectedOptions[0];
        reportdesc = opt.reportDesc ;
        createReport();
    }
}

function initRobots(robots, name) {
    let sel = document.getElementById('selrobot');

    let opt = document.createElement('option');
    opt.innerHTML = noRobotSelected;
    opt.robotID = -1;
    opt.robotName = noRobotSelected;
    sel.appendChild(opt);

    for (let robot of robots) {
        let opt = document.createElement('option');
        opt.innerHTML = robot.name;
        opt.robotID = robot.id;
        opt.robotName = robot.name;
        sel.appendChild(opt);

        if (robot.name === name) {
            robotid = robot.id ;
        }
    }

    sel.value = name ;
}

function initReports() {
    let sel = document.getElementById('selreport') ;
    for(let one of reports) {
        let opt = document.createElement('option') ;
        opt.reportName = one.name ;
        opt.reportDesc = one ;
        opt.innerHTML = one.name ;
        sel.appendChild(opt) ;
    }

    $.getJSON('/dashboard/info', (data) => {
        if (data.error !== undefined) {
            if (data.loggedin !== undefined && data.loggedin === false) {
                //
                // The user is not logged in, tell the user
                //
                tellLogin();
            }
            else {
                //
                // There was an error, tell the user
                //
                tellUser(true, data.error);
            }
        }
        else if (data.robots.length === 0) {
            tellUser(false, 'There are no robots defined, create a robot to see the dashboard');
        }
        else {
            var usenotrobot = true;
            var rname = undefined ;
            if (data.robot !== undefined) {
                let name = getRobotName(data.robots, data.robot);
                if (name.length > 0) {
                    rname = name ;
                }
            }
            if (rname === undefined) {
                rname = noRobotSelected ;
            }

            initRobots(data.robots, rname) ;
            reportdesc = reports[0] ;
            if (robotid !== undefined) {
                createReport() ;
            }
        }
    });        
}

$(document).ready(initReports);