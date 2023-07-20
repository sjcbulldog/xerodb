const leftMargin = 10 ;
const rightMargin = 60 ;
const topMargin = 10 ;
const lineSpacing = 30 ;
const lineWidth = 10 ;
const labelWidth = 200 ;
const levelIndent = 24 ;
const tooltipSideMargin = 20 ;
const tooltipFont = 
{
    name: 'Arial',
    size: '18px'
}

const labelFont = 
{
    name: 'Arial',
    size: '24px'
} ;

const durationFont = 
{
    name: 'Arial',
    size: '18px'
} ;
const stateIdle = 0 ;
const stateWaiting = 1 ;
const stateDisplaying = 2 ;

var tohandle = undefined ;
let pt = undefined ;
var state = stateIdle ;
var deepx = 0 ;
var gcanvas = undefined ;
var maxdays = 0 ;
var infinityStr = '\u221E'
var parts;

function getTextWidth(font, str) {
     
    text = document.createElement("span");
    document.body.appendChild(text);
 
    text.style.font = font.name ;
    text.style.fontSize = font.size ;
    text.style.height = 'auto';
    text.style.width = 'auto';
    text.style.position = 'absolute';
    text.style.whiteSpace = 'no-wrap';
    text.innerHTML = str ;
 
    width = Math.ceil(text.clientWidth);
    document.body.removeChild(text);
    return width ;
}

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
    ctx.font = labelFont.size + ' ' + labelFont.name ;
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
    
    ctx.font = durationFont.size + " " + durationFont.name ;
    ctx.fillText(daystr, deepx + width + 10, part.drawY);
}

function drawGantt(part) {
    deepx = 0 ;
    var ctx = gcanvas.getContext('2d');
    ctx.fillStyle = 'black' ;
    ctx.font = durationFont.size + " " + durationFont.name ;
    ctx.textBaseline = "top" ;

    drawOneLabel(ctx, part, leftMargin, topMargin) ;
    deepx += labelWidth ;

    var xpixels = gcanvas.width - deepx - leftMargin - rightMargin ;
    ctx.lineWidth = lineWidth ;
    ctx.font = durationFont.size + " " + durationFont.name ;
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



function findPart(pps, tpt) {
    if (pps === undefined)
        return undefined ;

    for(let part of pps) {
        if (tpt.y > part.drawY && tpt.y < part.drawY + lineSpacing) {
            return part ;
        }
    }

    for(let part of pps) {
        let p = findPart(part.children, tpt) ;
        if (p !== undefined)
            return p ;
    }
    
    return undefined ;
}

function createToolTip() {
    let p = findPart(parts, pt) ;
    if (p) {
        let ctx = gcanvas.getContext('2d');

        let width = getTextWidth(tooltipFont, p.desc);

        ctx.strokeStyle = "rgb(32, 32, 32)";
        ctx.fillStyle = "rgba(212, 212, 212, 1.0)";
        ctx.beginPath();
        ctx.roundRect(pt.x, pt.y, width + 2 * tooltipSideMargin, 30, 20);
        ctx.stroke();
        ctx.fill();

        ctx.fillStyle = 'black' ;
        ctx.font = tooltipFont.size + ' ' + tooltipFont.size ;
        ctx.fillText(p.desc, pt.x + tooltipSideMargin, pt.y + 8);
        state = stateDisplaying ;
    }
    else {
        state = stateIdle ; 
    }
}

function showToolTip() {
    if (state === stateWaiting) {
        createToolTip();
    }
}

function canvasMouseMove(e) {
    if (state === stateWaiting) {
        window.clearTimeout(tohandle);
        state = stateIdle ;
    }
    else if (state === stateDisplaying) {
        let ctx = gcanvas.getContext('2d');
        ctx.fillStyle = 'white' ;
        ctx.fillRect(0, 0, gcanvas.width, gcanvas.height);
        drawGantt(parts[0]) ;
        state = stateIdle ;
    }

    if (state === stateIdle) {
        let cbounds = gcanvas.getBoundingClientRect();
        pt = { 
            x: e.clientX - cbounds.left,
            y: e.clientY - cbounds.top
        } ;

        tohandle = window.setTimeout(showToolTip, 1500);
        state = stateWaiting ;
    }
}

function canvasLeave(e) {
    if (state === stateWaiting) {
        window.clearTimeout(tohandle);
        state = stateIdle ;
    }
    else if (state === stateDisplaying) {
        let ctx = gcanvas.getContext('2d');
        ctx.fillStyle = 'white' ;
        ctx.fillRect(0, 0, gcanvas.width, gcanvas.height);
        drawGantt(parts[0]) ;
        state = stateIdle ;
    }
}

function canvasDoubleClick(e) {
    let cbounds = gcanvas.getBoundingClientRect();
    let mpt = { 
        x: e.clientX - cbounds.left,
        y: e.clientY - cbounds.top
    } ;

    let p = findPart(parts, mpt)
    if (p) {
        window.location.href = "/robots/editpart?partno=" + p.key + "&parttype=" + p.ntype + "&retplace=/robots/viewrobot$$$ROBOTID$$$";
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
    gcanvas.ondblclick = canvasDoubleClick;
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