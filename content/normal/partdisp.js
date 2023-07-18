const leftMargin = 10 ;
const topMargin = 10 ;
const lineSpacing = 30 ;
var deepx = 0 ;
var gcanvas = undefined ;
var maxdays = 0 ;

function drawOneLabel(ctx, part, x, y) {
    part.drawX = x ;
    part.drawY = y ;
    ctx.fillText(part.key, x, y, 240) ;

    if (part.children) {
        x += 24 ;

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
        ctx.strokeStyle = 'green' ;
    }
    else {
        width = pixels ;
        ctx.strokeStyle = 'red' ;
    }

    ctx.beginPath();
    ctx.moveTo(deepx, part.drawY + lineSpacing / 2);
    ctx.lineTo(deepx + width, part.drawY + lineSpacing / 2);
    ctx.stroke();

    if (part.children) {
        for(let child of part.children) {
            drawOneLine(ctx, days, pixels, child);
        }
    }
}

function drawGantt(part) {
    deepx = 0 ;
    var ctx = gcanvas.getContext('2d');
    ctx.font = "24px serif";
    ctx.textBaseline = "top" ;
    ctx.lineWidth = 10 ;
    drawOneLabel(ctx, part, leftMargin, topMargin) ;
    deepx += 240 ;

    var xpixels = gcanvas.width - deepx - leftMargin ;

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

function createCanvas(part) {
    let ganttdiv = document.getElementById('gantt');
    while (ganttdiv.firstChild) {
        ganttdiv.removeChild(ganttdiv.firstChild);
    }

    let lines = countTotal(part);

    gcanvas = document.createElement('canvas');
    ganttdiv.appendChild(gcanvas);
    gcanvas.id = 'gantt' ;
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

function initPage() {
    let title = document.getElementById('title') ;
    title.style.textAlign = 'center' ;
    title.style.fontSize = '28px' ;
    title.innerHTML = "<b>" + partnovalue + "</b>" ;

    $.getJSON('/robots/partdata?partno=' + partnovalue, (data) => {
        if (data.length != 1)
            return ;

        if (data[0].ntype.startsWith("A")) {
            doGantt(data[0]);
        }
    });
}

$(document).ready(initPage);