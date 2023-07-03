function getOneUser() {
    $.getJSON('/robots/partinfo?partno=' + partnovalue, (data) => {
        $('#partnotext').html('<b>' + data.key + ', ' + data.ntype + '</b>');
    }) ;
}

$(document).ready(getOneUser);