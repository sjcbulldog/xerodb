function showAllUsers() {
    $.getJSON('/robots/listall', (data) => {
        var content = '<table>' ;
        content += '<tr>' ;
        content += '<td><b>Robot</b></td>' ;
        content += '<td><b>Assembly</b></td>'
        content += '<td><b>Description</b></td>' ;
        content += '<td><b>Created By</b></td>' ;
        content += '<td><b>Created</b></td>'
        content += '<td><b>Last Modified</b></td>'
        content += '</tr>' ;

        for(let robot of data) {
            content += '<tr>'
            content += '<td>' + robot.name + '</td>' ;
            content += '<td><a title="View Robot" href=/robots/viewpart?partno=' + robot.part + '>' + robot.part + '</td>' ;
            content += '<td>' + robot.description + '</td>' ;
            content += '<td>' + robot.creator + '</td>' ;
            content += '<td>' + robot.created + '</td>' ;
            content += '<td>' + robot.modified + '</td>'
            content += '</tr>'
        }
        content += '</table>';
        $('.table').append(content) ;
    }) ;
}

$(document).ready(showAllUsers);