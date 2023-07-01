$(document).ready(() => {
    $.getJSON('/robots/parttree?partno='+partno, (data) => {
        console.log('data: ' + data);
    });
});
