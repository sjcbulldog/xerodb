function addOneAttribute(attr, lastone) {
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

function getOnePart() {
    $.getJSON('/robots/partinfo?partno=' + partnovalue, (data) => {
        $('#partnotext').html('<b>' + data.key + ', ' + data.ntype + '</b>');

        var lastone = document.getElementById('lastone') ;
        for(var attr of data.attribs) {
            lastone = addOneAttribute(attr, lastone);
        }

        if (data.desc !== 'Double Click To Edit') {
            $('#desc').val(data.desc)
        }

        $('#quantity').val(data.quantity);
        $('#partno').val(partnovalue)
    }) ;
}

$(document).ready(getOnePart);