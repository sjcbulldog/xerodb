const leftMargin = 10 ;
const rightMargin = 60 ;
const topMargin = 10 ;
const lineSpacing = 30 ;
const lineWidth = 10 ;
const labelWidth = 200 ;
const levelIndent = 24 ;
var deepx = 0 ;
var gcanvas = undefined ;
var maxdays = 0 ;
var infinityStr = '\u221E'
var parts;

function maxParentDays(part) {
    let ret = 0 ;
    part = part.parentPart ;
    while (part) {
        if (part.days > ret) {
            ret = part.days ;
        }

        part = part.parentPart ;
    }

    return ret ;
}

function drawOneLabel(ctx, part, x, y) {
    part.drawX = x ;
    part.drawY = y ;
    ctx.fillText(part.key, x, y, labelWidth) ;

    if (part.children) {
        x += levelIndent ;

        if (x > deepx) {
            deepx = x ;
        }

        for(let child of part.children) {
            y += lineSpacing ;
            y = drawOneLabel(ctx, child, x, y) ;
        }
    }

    return y ;
}

function drawOneLine(ctx, days, pixels, part) {

    let width ;
    
    if (isFinite(part.days)) {
        width = part.days / days * pixels ;

        if (part.parentPart && part.days > maxParentDays(part)) {
            ctx.strokeStyle = 'yellow' ;
        }
        else {
            ctx.strokeStyle = 'green' ;
        }

    }
    else {
        width = pixels ;
        ctx.strokeStyle = 'red' ;
    }

    let y = part.drawY + lineSpacing / 2 - lineWidth / 2;
    ctx.beginPath();
    ctx.moveTo(deepx, y);
    ctx.lineTo(deepx + width, y);
    ctx.stroke();

    if (part.children) {
        for(let child of part.children) {
            drawOneLine(ctx, days, pixels, child);
        }
    }

    let daystr ;
    if (isFinite(part.days))
        daystr = part.days + ' days' ;
    else
        daystr = infinityStr + ' days' ;
    ctx.fillText(daystr, deepx + width + 10, part.drawY);
}

function drawGantt(part) {
    deepx = 0 ;
    var ctx = gcanvas.getContext('2d');
    ctx.font = "24px serif";
    ctx.textBaseline = "top" ;

    drawOneLabel(ctx, part, leftMargin, topMargin) ;
    deepx += labelWidth ;

    var xpixels = gcanvas.width - deepx - leftMargin - rightMargin ;
    ctx.lineWidth = lineWidth ;
    ctx.font = "16px serif";
    ctx.textBaseline = "top" ;
    drawOneLine(ctx, maxdays, xpixels, part);
}

function countTotal(part) {
    let ret = 1 ;

    if (part.children) {
        for(let one of part.children) {
            ret += countTotal(one);
        }
    }

    return ret ;
}

var tohandle = undefined ;
var tooltip = false ;
var pt = undefined ;

function findPart() {
    let p = undefined ;

    for(let part of parts) {
        if (pt.y > part.drawY && pt.y < part.drawY + lineSpacing) {
            p = part ;
            break ;
        }
    }

    return p ;
}

function createToolTip() {
    let ret = false ;
    let p = findPart() ;
    if (p) {
        let ctx = gcanvas.getContext('2d');
        ctx.fillStyle = 'blue' ;
        ctx.fillRect(pt.x, pt.y, 100, 100) ;
        ret = true ;
    }

    return ret;
}

function showToolTip() {
    tohandle = undefined ;
    console.log("timer fired");

    if (pt && tooltip === false) {
        tooltip = createToolTip() ;

        console.log("created tooltip " + tooltip) ;
    }
}

function canvasMouseMove(e) {
    if (tohandle) {
        console.log("clear timer");
        window.clearTimeout(tohandle);
        tohandle = undefined ;
    }

    if (tooltip) {
        let ctx = gcanvas.getContext('2d');
        ctx.fillStyle = 'white' ;
        ctx.fillRect(0, 0, gcanvas.width, gcanvas.height);
        drawGantt(parts[0]) ;
        tooltip = false ;
    }

    if (tooltip === false) {
        
        let cbounds = gcanvas.getBoundingClientRect();
        pt = { 
            x: e.clientX - cbounds.left,
            y: e.clientY - cbounds.top
        } ;

        console.log("set timer");
        window.setTimeout(showToolTip, 5000);
    }
}

function canvasLeave(e) {
    if (tohandle) {
        window.clearTimeout(tohandle);
    }
}

function createCanvas(part) {
    let ganttdiv = document.getElementById('gantt');
    while (ganttdiv.firstChild) {
        ganttdiv.removeChild(ganttdiv.firstChild);
    }

    let lines = countTotal(part);

    gcanvas = document.createElement('canvas');
    gcanvas.onmousemove = canvasMouseMove;
    gcanvas.onmouseleave = canvasLeave ;
    ganttdiv.appendChild(gcanvas);
    gcanvas.id = 'ganttcanvas' ;
    gcanvas.width = ganttdiv.clientWidth;
    gcanvas.height = (lines + 1) * lineSpacing ;
}

function computeDays(part, maxdays) {
    var ret ;

    let now = new Date() ;
    let tstamp = Date.parse(part.donedate) ;
    if (isNaN(tstamp)) {
        ret = Infinity ;
    }
    else {
        var diff = tstamp - now.getTime();
        if (diff > 0) {
            ret = Math.ceil(diff / (1000 * 3600 * 24)); 
        }
        else {
            ret = 0 ;
        }
    }
    part.days = ret ;

    if (ret > maxdays && isFinite(ret)) {
        maxdays = ret ;
    }

    if (part.children) {
        for(let one of part.children) {
            one.parentPart = part ;
            maxdays = computeDays(one, maxdays);
        }
    }

    return maxdays ;
}

function doGantt(part) {
    maxdays = computeDays(part, 0);
    createCanvas(part) ;
    drawGantt(part);
}

function createDrawingTableHeader() {
    let tr = document.createElement('tr');
    let th ;

    th = document.createElement('th');
    th.innerHTML = 'Title' ;
    tr.appendChild(th);

    th = document.createElement('th');
    th.innerHTML = 'Version' ;
    tr.appendChild(th);

    return tr ;
}

function createDrawingRow(drawing) {
    let tr = document.createElement('tr');
    let td ;

    td = document.createElement('td');

    let htmlstr = '<a target="_blank" href="/drawings/show?partno=' + partnovalue + '&set=' + drawing.set + '&version=' + drawing.version + '">' ;
    if (drawing.dtype.startsWith('Drawing File'))
        htmlstr += '<img src="/nologin/images/file.png" width=32 height=32>  ' ;
    else
        htmlstr += '<img src="/nologin/images/link.png" width=32 height=32>  ' ;

    htmlstr += drawing.title;
    htmlstr += '</a>' ;

    td.innerHTML = htmlstr ;
    tr.appendChild(td);

    td = document.createElement('td');
    td.innerHTML = drawing.version;
    tr.appendChild(td);

    return tr ;
}

function doDrawings(drawings) {
    let drawingsdiv = document.getElementById('drawings');
    while (drawingsdiv.firstChild) {
        drawingsdiv.removeChild(drawingsdiv.firstChild);
    }

    let table = document.createElement('table');
    table.className = 'styled-table';
    drawingsdiv.appendChild(table);
    table.appendChild(createDrawingTableHeader());

    for(let one of drawings) {
        table.appendChild(createDrawingRow(one));
    }
}

function createPair(name, value) {
    let tr = document.createElement('tr');
    let td = document.createElement('td');
    td.innerHTML = name ;
    tr.appendChild(td);

    td = document.createElement('td');
    td.innerHTML = value ;
    tr.appendChild(td);

    return tr ;
}

function doBasic(part) {
    let drawingsdiv = document.getElementById('basic');
    while (drawingsdiv.firstChild) {
        drawingsdiv.removeChild(drawingsdiv.firstChild);
    }

    let table = document.createElement('table');
    table.className = 'styled-table';

    drawingsdiv.appendChild(table);
    table.appendChild(createPair('Part Number', part.title));
    table.appendChild(createPair('Description', part.desc));
    table.appendChild(createPair('Type', part.ntype));
    table.appendChild(createPair('State', part.state));
    table.appendChild(createPair('Done Date', part.donedate));
    table.appendChild(createPair('Next State', part.nextdate));
    table.appendChild(createPair('Notes', part.notes));
    table.appendChild(createPair('Quantity', part.quantity));

    for (var attr of part.attribs) {
        table.appendChild(createPair(attr.key, attr.value));
    }
}

function initPage() {
    $.getJSON('/robots/partdata?partno=' + partnovalue, (data) => {
        parts = data ;

        if (data.length != 1)
            return ;

        if (data[0].ntype.startsWith("A")) {
            doGantt(data[0]);
        }

        doBasic(data[0]);
    });

    $.getJSON('/drawings/drawingslist?titles=true&partno=' + partnovalue, (data) => {
        doDrawings(data);
    })
}

$(document).ready(initPage);