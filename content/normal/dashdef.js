let currentRobot = undefined;
let robots = undefined;
let latetree = undefined;
let statetree = undefined;
let statechart = undefined;

const noRobotSelected = '-- No Robot Selected --';

function tellUser(error, msg) {
    alert(msg);
}

function tellLogin() {
    alert('You are not logged in.');
    window.parent.location.href = '/nologin/login.html';
}

function populateLateChart(data) {
    $('#canvas2').replaceWith('<canvas id="canvas2"></canvas>');

    let ctx = document.getElementById('canvas2');
    new Chart(ctx,
        {
            type: 'bar',
            data: {
                labels: data.map(row => row.label),
                datasets: [
                    {
                        label: 'Parts',
                        data: data.map(row => row.value)
                    }
                ]
            },
            options: {
                plugins: {
                    title: {
                        text: 'Late Parts (next state)',
                        display: true
                    },
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });    
}

function populateStateChart(data) {
    $('#canvas1').replaceWith('<canvas id="canvas1"></canvas>');

    let mydata = []

    for (let one of data) {
        var onest = {
            label: one.title,
            value: one.children.length
        }
        mydata.push(onest);
    }

    let ctx = document.getElementById('canvas1');
    new Chart(ctx,
        {
            type: 'bar',
            data: {
                labels: mydata.map(row => row.label),
                datasets: [
                    {
                        label: 'Parts',
                        data: mydata.map(row => row.value)
                    }
                ]
            },
            options: {
                plugins: {
                    title: {
                        text: 'Parts By State',
                        display: true
                    },
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
}

function populateDashboard(id) {
    currentRobot = id;

    $.getJSON('/dashboard/state?robotid=' + currentRobot, (data) => {
        populateStateChart(data);
    });

    $.getJSON('/dashboard/latechart?type=next&robotid=' + currentRobot, (data) => {
        populateLateChart(data);
    });

    if (latetree !== undefined) {
        latetree.load({ url: '/dashboard/late?robotid=' + currentRobot });
    }

    if (statetree !== undefined) {
        statetree.load({ url: '/dashboard/state?robotid=' + currentRobot });
    }
}

function selectRobot(sel) {
    if (sel.selectedOptions.length === 1) {
        let opt = sel.selectedOptions[0];
        $.getJSON('/dashboard/setrobot?robotid=' + opt.robotID);
        populateDashboard(opt.robotID);
    }
}

function createLateTree(which) {
    $('#title' + which).html('Parts Late To Schedule');
    latetree = new mar10.Wunderbaum({
        element: document.getElementById("list" + which),
        source: {
            url: "/dashboard/empty"
        },
        columns: [
            { id: "*", title: "Part", width: "250px" },
            { id: "student", title: "Student", width: "120px" },
            { id: "mentor", title: "Mentor", width: "120px" },
            { id: "nextdate", title: "Next Date", width: "120px" },
            { id: "donedate", title: "Done Date", width: "120px" },
            { id: "desc", title: "Description" }
        ],
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

function createStateTree(which) {
    $('#title' + which).html('Parts By State');
    statetree = new mar10.Wunderbaum({
        element: document.getElementById("list" + which),
        source: {
            url: "/dashboard/empty"
        },
        columns: [
            { id: "*", title: "Part", width: "250px" },
            { id: "student", title: "Student", width: "120px" },
            { id: "mentor", title: "Mentor", width: "120px" },
            { id: "nextdate", title: "Next Date", width: "120px" },
            { id: "donedate", title: "Done Date", width: "120px" },
            { id: "desc", title: "Description" }
        ],
        render: function (e) {
            const node = e.node;
            node.tooltip = node.data.desc;
            for (const col of Object.values(e.renderColInfosById)) {
                col.elem.textContent = node.data[col.id];
            }
        },
        enhanceTitle: function (e) {
            if (e.node.data.desc)
                e.titleSpan.title = e.node.data.desc;
        },
        dblclick: function (e) {
            if (/^[0-9][0-9][0-9]-[A-Za-z]+-[0-9][0-9][0-9][0-9][0-9]$/.test(e.node.key)) {
                window.location.href = "/robots/editpart?partno=" + e.node.key + "&parttype=" + e.node.data.ntype + "&retplace=/normal/dashdef.html";
            }
        },
    });
}

function getRobotName(robots, id) {
    for (let one of robots) {
        if (one.id === id) {
            return one.name;
        }
    }

    return '';
}

function createByStateChart() {
}

function loadDashboard() {
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
            $('#username').html("<b>Username:</b> " + data.username);
            robots = data.robots;
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
            }

            createLateTree(1);
            createStateTree(2);

            var usenotrobot = true;
            if (data.robot !== undefined) {
                let name = getRobotName(data.robots, data.robot);
                if (name.length > 0) {
                    sel.value = name;
                    populateDashboard(data.robot);
                    usenotrobot = false;
                }
            }

            if (usenotrobot) {
                sel.value = noRobotSelected;
                populateDashboard(-1);
            }
        }
    });
}

$(document).ready(loadDashboard);