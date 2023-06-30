$(document).ready(() => {
    $('#passworderror').hide() ;
}) ;

$('#changepwd').submit(function (e) {
    if ($("#newpwd").val() !== $("#secondpwd").val()) {
        $('#passworderror').show();
        e.preventDefault();
    }
}) ;
