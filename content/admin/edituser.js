function getOneUser() {
    $.getJSON('/users/userinfo?username=' + usernamevalue, (data) => {
        $('#usernametext').html('<b>UserName: ' + data.username + '</b>') ;
        $('#username').val(data.username);
        $('#firstname').val(data.firstname) ;
        $('#lastname').val(data.lastname) ;
        $('#email').val(data.email);

        var roles = "" ;
        console.log('length: ' + data.roles.length);
        if (data.roles.length === 0 || (data.roles.length == 1 && data.roles[0].length == 0)) {
            roles = "" ;
        }
        else {
            for(var role of data.roles) {
                if (roles.length > 0) {
                    roles += "," ;
                }
                roles += role ;
            }
        }
        $('#roles').val(roles);
        $('#state').val(data.state);
    }) ;
}

$(document).ready(getOneUser);