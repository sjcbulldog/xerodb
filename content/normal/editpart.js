const dblmsg = 'Double Click To Edit' ;

function addOneSelect(attr, lastone, choices, value) {
    var parent = lastone.parentElement;

    var div = document.createElement('div') ;
    var nextone = lastone.nextElementSibling;
    parent.insertBefore(div, nextone) ;

    var label = document.createElement('label') ;
    label.for = attr.key;
    label.textContent = attr.key ;
    div.appendChild(label) ;

    var br = document.createElement('br') ;
    div.appendChild(br);

    var select = document.createElement('select');
    select.id = attr.key ;
    select.name = attr.key ;

    for(let choice of choices) {
        let opt = document.createElement('option');
        opt.value = choice ;
        opt.innerHTML = choice ;
        select.appendChild(opt) ;
    }

    select.value = value ;
    div.appendChild(select) ;

    return div ;
}

function addOneInput(attr, lastone) {
    var parent = lastone.parentElement;

    var div = document.createElement('div') ;
    var nextone = lastone.nextElementSibling;
    parent.insertBefore(div, nextone) ;

    var label = document.createElement('label') ;
    label.for = attr.key;
    label.textContent = attr.key ;
    div.appendChild(label) ;

    var input = document.createElement('input') ;
    if (attr.desc.type === 'string') {
        input.type = 'text' ;
    }
    else if (attr.desc.type === 'int') {
        input.type = 'text' ;
    }
    else if (attr.desc.type === 'double') {
        input.type = 'text' ;        
    }

    if (attr.desc.required) {
        input.required = true ;
    }

    input.id = attr.key ;
    input.value = attr.value ;
    input.name = attr.key ;
    input.placeholder = attr.key ;       
    div.appendChild(input) ;

    return div ;
}

function setStudentOrMentor(data, lastone, name, value, choices) {
    var parent = lastone.parentElement;

    var div = document.createElement('div') ;
    var nextone = lastone.nextElementSibling;
    parent.insertBefore(div, nextone) ;

    let editable = data.admin || (data.student.length == 0 && data.mentor.length == 0) ;

    var label = document.createElement('label') ;
    label.for = name ;
    label.textContent = name ;
    div.appendChild(label) ;

    var br = document.createElement('br') ;
    div.appendChild(br);

    var select = document.createElement('select');
    select.id = name ;
    select.name = name ;

    for(let choice of choices) {
        let opt = document.createElement('option');
        opt.value = choice ;
        opt.innerHTML = choice ;
        select.appendChild(opt) ;
    }

    select.value = value ;
    div.appendChild(select) ;

    if (!editable) {
        select.disabled = true ;
    }

    return div ;
}

function setState(data, lastone) {
    var parent = lastone.parentElement;

    var div = document.createElement('div') ;
    var nextone = lastone.nextElementSibling;
    parent.insertBefore(div, nextone) ;

    var label = document.createElement('label') ;
    label.for = 'state' ;
    label.textContent = 'State';
    div.appendChild(label) ;

    var br = document.createElement('br');
    div.appendChild(br);

    var select = document.createElement('select');
    select.id = 'state' ;
    select.name = 'state' ;

    let opt = document.createElement('option') ;
    opt.value = data.state ;
    opt.innerHTML = data.state ;
    select.appendChild(opt);

    for(let choice of data.nextstates) {
        opt = document.createElement('option');
        opt.value = choice ;
        opt.innerHTML = choice ;
        select.appendChild(opt) ;
    }

    select.value = data.state ;
    div.appendChild(select) ;

    if (data.nextstates.length == 0) {
        select.disabled = true ;
    }

    return div ;
}

function getOnePart() {
    $.getJSON('/robots/partinfo?partno=' + partnovalue, (data) => {
        $.getJSON('/users/withrole?role=mentor', (mentors) => {
            $.getJSON('/users/withrole?role=student', (students) => {
                $.getJSON('/robots/mantypes', (mantypes) => {
                    $.getJSON('/robots/alldescs?partno=' + partnovalue, (descs) => {
                        $('#partnotext').html('<b>' + data.key + ', ' + data.ntype + '</b>');

                        var lastone = document.getElementById('lastone') ;

                        lastone = setState(data, lastone) ;
                        lastone = setStudentOrMentor(data, lastone, 'student', data.student, students) ;
                        lastone = setStudentOrMentor(data, lastone, 'mentor', data.mentor, mentors) ;

                        for(var attr of data.attribs) {
                            var choices = [] ;
                            if (attr.desc.type === 'mentor') {
                                lastone = addOneSelect(attr, lastone, mentors, attr.value) ;
                            }
                            else if (attr.desc.type === 'student') {
                                lastone = addOneSelect(attr, lastone, students, attr.value);
                            }
                            else if (attr.desc.type === 'manufacturingtype') {
                                lastone = addOneSelect(attr, lastone, mantypes, attr.value);                                
                            }
                            else {
                                lastone = addOneInput(attr, lastone);
                            }
                        }

                        if (data.desc !== dblmsg) {
                            $('#desc').val(data.desc)
                        }

                        let listparent = document.getElementById('descidparent');
                        let datalist = document.createElement('datalist') ;
                        datalist.id = 'descid' ;

                        for(let desc of descs) {
                            if (desc !== dblmsg) {
                                let option = document.createElement('option');
                                option.value = desc ;
                                datalist.appendChild(option);
                            }
                        }
                        listparent.appendChild(datalist) ;

                        $('#quantity').val(data.quantity);
                        $('#partno').val(partnovalue);
                    }) ;
                }) ;
            });
        });
    }) ;
}

$(document).ready(getOnePart);