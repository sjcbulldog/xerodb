
function notificationChanged(e) {
    if (e.srcElement) {
        if (e.srcElement.partno) {
            if (e.srcElement.checked) {
                $.getJSON('/robots/notify?partno=' + e.srcElement.partno + '&enabled=true');
            }
            else {
                $.getJSON('/robots/notify?partno=' + e.srcElement.partno + '&enabled=false');                
            }
        }
    }
}

function createCell(name, bold) {
    let td = document.createElement('td') ;
    if (bold) {
        let b = document.createElement('b') ;
        b.innerHTML = name ;
        td.appendChild(b);
    }
    else {
        td.innerHTML = name ;
    }

    return td ;
}

function createLinkedCell(name, id) {
    let td = document.createElement('td') ;
    let a = document.createElement('a');
    td.appendChild(a) ;
    a.title = 'Show Robot Parts';
    a.href = '/robots/viewrobot?robotid=' + id ;
    a.innerHTML = name ;

    return td ;
}

function createNotifiyCell(notify, partno) {
    let td = document.createElement('td') ;
    let input = document.createElement('input') ;
    td.appendChild(input) ;
    input.type = 'checkbox';
    input.onclick = notificationChanged ;
    input.partno = partno ;
    if (notify) {
        input.checked = true ;
    }
    return td ;
}

function createDeleteCell(partno) {
    let td = document.createElement('td') ;
    let link = document.createElement('a') ;
    link.href = "/robots/delete?id=" + partno ;
    td.appendChild(link) ;
    let par = document.createElement('p') ;
    link.appendChild(par) ;
    par.innerHTML = "delete" ;
    return td ;
}

function showAllRobots() {
    $.getJSON('/robots/listall', (data) => {
        let table = document.createElement('table') ;
        let tr = document.createElement('tr');

        table.appendChild(tr) ;
        tr.appendChild(createCell('Robot', true)) ;
        tr.appendChild(createCell('Description', true)) ;
        tr.appendChild(createCell('Created By', true)) ;
        tr.appendChild(createCell('Created', true)) ;
        tr.appendChild(createCell('Last Modified', true)) ;
        tr.appendChild(createCell('Notifications', true)) ;
        tr.appendChild(createCell('Delete', true)) ;

        for(let robot of data) {
            tr = document.createElement('tr');
            table.appendChild(tr);
            tr.appendChild(createLinkedCell(robot.name, robot.id));
            tr.appendChild(createCell(robot.description));
            tr.appendChild(createCell(robot.creator));
            tr.appendChild(createCell(robot.created));
            tr.appendChild(createCell(robot.modified));
            tr.appendChild(createNotifiyCell(robot.notify, robot.id));
            tr.appendChild(createDeleteCell(robot.id)) ;
        }


        $('.table').append(table);
    }) ;
}

$(document).ready(showAllRobots);
