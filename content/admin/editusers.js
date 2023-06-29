function showAllUsers() {
    $.getJSON('/users/allusers', (data) => {
        var content = '<table>' ;
        content += '<tr>' ;
        content += '<td><b>Username</b></td>' ;
        content += '<td><b>Last Name</b></td>' ;
        content += '<td><b>First Name</b></td>' ;
        content += '<td><b>Roles</b></td>'
        content += '<td><b>State</b></td>' ;
        content += '</tr>' ;

        for(let user of data) {
            content += '<tr>'
            content += '<td>' ;
            content += '<a title="Edit User" href=/users/editone?username='+user.username + '>' + user.username + '</td>'
            content += '<td>' + user.firstname + '</td>' ;
            content += '<td>' + user.lastname + '</td>' ;

            let str = "" ;
            for(let role of user.roles) {
                str += role + ' ' ;
            }
            content += '<td>' + str + '</td>' ;
            content += '<td>' + user.state + '</td>' ;
            content += '</tr>'
        }
        content += '</table>';
        $('.table').append(content) ;
    }) ;
}

$(document).ready(showAllUsers);