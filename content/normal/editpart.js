var oldstate = undefined ;
var olddate = undefined ;

function backToRobotPage() {
    $('editpartform').submit(function(e){ e.preventDefault(); });
    window.location.href="/robots/showrobotbypart?partno=" + partnovalue ;
}

function addOneSelect(attr, lastone, choices, value) {
    var parent = lastone.parentElement;

    var div = document.createElement('div');
    var nextone = lastone.nextElementSibling;
    parent.insertBefore(div, nextone);

    var label = document.createElement('label');
    label.for = attr.key;
    label.textContent = attr.key;
    div.appendChild(label);

    var br = document.createElement('br');
    div.appendChild(br);

    var select = document.createElement('select');
    select.id = attr.key;
    select.name = attr.key;

    if (attr.desc.required) {
        select.required = true;
    }

    for (let choice of choices) {
        let opt = document.createElement('option');
        opt.value = choice;
        opt.innerHTML = choice;
        select.appendChild(opt);
    }

    select.value = value;
    div.appendChild(select);

    return div;
}

function addOneInput(attr, lastone) {
    var parent = lastone.parentElement;

    var div = document.createElement('div');
    var nextone = lastone.nextElementSibling;
    parent.insertBefore(div, nextone);

    var label = document.createElement('label');
    label.for = attr.key;
    label.textContent = attr.key;
    div.appendChild(label);

    var input = document.createElement('input');
    input.xerodbAttribute = attr.desc.type;
    if (attr.desc.type === 'string') {
        input.type = 'text';
    }
    else if (attr.desc.type === 'int') {
        input.type = 'text';
    }
    else if (attr.desc.type === 'double') {
        input.type = 'text';
    }
    else if (attr.desc.type === 'currency') {
        input.type = 'text';
    }
    else {
        alert("Unknown attribute type ('" + attr.desc.type + "') in page");
    }

    if (attr.desc.required) {
        input.required = true;
    }

    input.id = attr.key;
    input.value = attr.value;
    input.name = attr.key;
    input.placeholder = attr.key;
    div.appendChild(input);

    return div;
}

function setStudentOrMentor(data, lastone, name, value, choices) {
    var parent = lastone.parentElement;

    var div = document.createElement('div');
    var nextone = lastone.nextElementSibling;
    parent.insertBefore(div, nextone);

    let editable = data.admin || data.state === "Unassigned" ;

    var label = document.createElement('label');
    label.for = name;
    label.textContent = name;
    div.appendChild(label);

    var br = document.createElement('br');
    div.appendChild(br);

    var select = document.createElement('select');
    select.id = name;
    select.name = name;

    for (let choice of choices) {
        let opt = document.createElement('option');
        opt.value = choice;
        opt.innerHTML = choice;
        select.appendChild(opt);
    }

    select.value = value;
    div.appendChild(select);

    if (!editable) {
        select.disabled = true;
    }

    return div;
}

function stateChanged(e) {
    let st = e.target.value ;
    $('#nextstatelabel').html("'" + st + "' Date");

    if (!checkStateChange()) {
        // The state changed - prompt the user to change the new date
        alert('You have changed to state, you also need to change the date for this next state') ;
        $('#nextstatelabel').focus();
    }
}

function setState(data, lastone) {
    var parent = lastone.parentElement;

    var div = document.createElement('div');
    var nextone = lastone.nextElementSibling;
    parent.insertBefore(div, nextone);

    var label = document.createElement('label');
    label.for = 'state';
    label.textContent = 'State';
    div.appendChild(label);

    var br = document.createElement('br');
    div.appendChild(br);

    var select = document.createElement('select');
    select.id = 'state';
    select.name = 'state';
    select.onclick = stateChanged;

    if (data.mentor.length === 0 && data.student.length === 0) {
        select.title = 'Assign a student and mentor to move from unassigned state';
    }
    else if (data.nextstates.length === 0) {
        select.title = 'You cannot change the state';
    }
    else {
        select.title = 'Change State';
    }

    let opt = document.createElement('option');
    opt.value = data.state;
    opt.innerHTML = data.state;
    select.appendChild(opt);

    for (let choice of data.nextstates) {
        opt = document.createElement('option');
        opt.value = choice;
        opt.innerHTML = choice;
        select.appendChild(opt);
    }

    select.value = data.state;
    div.appendChild(select);

    if (data.nextstates.length == 0) {
        select.disabled = true;
    }

    return div;
}

let xeroAttrs = null;

function getInputValue(name) {
    let input = document.getElementById(name);
    if (input === undefined)
        return '' ;

    return input.value ;
}

function checkStateChange() {
    let newstate = getInputValue('state') ;
    let newdate = getInputValue('nextdate');

    if (newstate !== oldstate && newstate !== 'Done') {
        if (newdate === olddate || newdate === '') {
            return false;
        }
    }

    return true ;
}

function doValidate(e) {
    if (xeroAttrs === null)
        return;

    if (!checkStateChange()) {
        alert('You have changed the state of the part. You need to update the Next Date which is the date when the part will leave this new state');
        e.preventDefault();
        return ;        
    }

    for (var attr of xeroAttrs) {
        let input = document.getElementById(attr.key);
        if (input) {
            if (attr.desc.type === 'int') {
                let v = /^[+-]*[0-9]+$/.test(input.value);
                if (!v) {
                    alert("The value '" + input.vaule + "' for the field '" + attr.key + "' is not a valid integer");
                    e.preventDefault();
                }
            }
            else if (attr.desc.type === 'double') {
                let v = /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$/.test(input.value);
                if (!v) {
                    alert("The value '" + input.vaule + "' for the field '" + attr.key + "' is not a valid floating point number");
                    e.preventDefault();
                }
            }
            else if (attr.desc.type === 'currency') {
                if (input.value.startsWith('$')) {
                    input.value = input.value.substring(1);
                }
                let v = /^[0-9]+.?[0-9]+$/.test(input.value);
                if (!v) {
                    alert("The value '" + input.value + "' for the field '" + attr.key + "' is not a valid currency value");
                    e.preventDefault();
                }
            }
        }
    }
}

function getOnePart() {
    $.getJSON('/robots/partinfo?partno=' + partnovalue, (data) => {
        $.getJSON('/users/withrole?role=mentor', (mentors) => {
            $.getJSON('/users/withrole?role=student', (students) => {
                $.getJSON('/robots/alldescs?partno=' + partnovalue, (descs) => {
                    $('#partnotext').html('<b>' + data.key + ', ' + data.ntype + '</b>');

                    oldstate = data.state ;
                    olddate = data.nextdate;

                    let form = document.getElementById('editpartform');
                    form.onsubmit = doValidate;

                    var lastone = document.getElementById('lastone');

                    lastone = setState(data, lastone);
                    lastone = setStudentOrMentor(data, lastone, 'student', data.student, students);
                    lastone = setStudentOrMentor(data, lastone, 'mentor', data.mentor, mentors);

                    xeroAttrs = data.attribs;
                    for (var attr of data.attribs) {
                        var choices = [];
                        if (attr.desc.type === 'mentor') {
                            lastone = addOneSelect(attr, lastone, mentors, attr.value);
                        }
                        else if (attr.desc.type === 'student') {
                            lastone = addOneSelect(attr, lastone, students, attr.value);
                        }
                        else if (attr.desc.type === 'choice') {
                            lastone = addOneSelect(attr, lastone, attr.desc.choices, attr.value);
                        }
                        else {
                            lastone = addOneInput(attr, lastone);
                        }
                    }

                    if (data.desc !== dblmsg) {
                        $('#desc').val(data.desc)
                    }

                    if (/^[0-9]+-[0-9]+-[0-9]+$/.test(data.donedate)) {
                        $('#donedate').val(data.donedate);
                    }
                    if (/^[0-9]+-[0-9]+-[0-9]+$/.test(data.nextdate)) {
                        $('#nextdate').val(data.nextdate);
                    }

                    $('#nextstatelabel').html("'" + oldstate + "' Date");
                    $('#notes').val(data.notes);

                    let listparent = document.getElementById('descidparent');
                    let datalist = document.createElement('datalist');
                    datalist.id = 'descid';

                    for (let desc of descs) {
                        if (desc !== dblmsg) {
                            let option = document.createElement('option');
                            option.value = desc;
                            datalist.appendChild(option);
                        }
                    }
                    listparent.appendChild(datalist);

                    $('#quantity').val(data.quantity);
                    $('#partno').val(partnovalue);
                    $('#retplace').val(retplace);
                    $('#location').val(data.location) ;
                });
            });
        });
    });
}

$(document).ready(getOnePart);