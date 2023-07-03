function getOneUser() {
    $.getJSON('/users/partinfo?partno=' + partno, (data) => {
        $('#partnotext').html('<b>Part Number: ' + data.partno + '</b>') ;
        $('#desc').val(data.desc) ;
    }) ;
}

$(document).ready(getOneUser);