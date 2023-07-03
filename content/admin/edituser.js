function getOneUser() {
    $.getJSON('/users/userinfo?username=' + usernamevalue, (data) => {
        $('#usernametext').html('<b>UserName: ' + data.username + '</b>') ;
        $('#username').val(data.username);
        $('#firstname').val(data.firstname) ;
        $('#lastname').val(data.lastname) ;
        $('#email').val(data.email);

        if (data.roles.indexOf('admin') !== -1) {
            $('#admin').prop('checked', true);
        }

        if (data.roles.indexOf('mentor') !== -1) {
            $('#mentor').prop('checked', true);
        }

        if (data.roles.indexOf('student') !== -1) {
            $('#student').prop('checked', true);
        }

        $('#state').val(data.state);
    }) ;
}

$(document).ready(getOneUser);