let parttree = undefined ;

function addDrawingToDB() {
    let filesel = document.getElementById('upload');
    let desc = document.getElementById('desc');
    var myFormData = new FormData();
    myFormData.append('drawing', filesel.files[0]);
    myFormData.append('partno', partnovalue);
    myFormData.append('desc', desc.value);

    $.ajax({
        url: '/drawings/adddrawing',
        type: 'POST',
        processData: false, // important
        contentType: false, // important
        dataType: 'json',
        data: myFormData,
        success: function (response, status) {
            parttree.load({ url : "/drawings/drawingslist?partno=" + partnovalue })
        }
    });
}

function newDrawing() {
    let html = `
    <br>
    <label for="desc">Description:</label>
    <input type="text" id="desc" name="desc" value=""></input>
    <br>
    <label for="upload">File To Upload:</label>
    <input type="file" id="upload" name="upload"></input>
    <br>`

    $("#dialog-confirm").html(html);
    $("#dialog-confirm").dialog({
        resizable: false,
        modal: true,
        title: "Add Drawing",
        height: 240,
        width: 512,
        buttons: {
            "Ok": function () {
                addDrawingToDB();
                $(this).dialog('close');
            },
            "Cancel": function () {
                $(this).dialog('close');
            }
        }
    });
}

function addDrawingVersionToDB() {
    let filesel = document.getElementById('upload');
    let desc = document.getElementById('desc');
    var myFormData = new FormData();
    myFormData.append('drawing', filesel.files[0]);
    myFormData.append('partno', partnovalue);
    myFormData.append('desc', parttree.activeNode.data.title);
    myFormData.append('set', parttree.activeNode.data.set);

    $.ajax({
        url: '/drawings/adddrawingversion',
        type: 'POST',
        processData: false, // important
        contentType: false, // important
        dataType: 'json',
        data: myFormData,
        success: function (response, status) {
            parttree.load({ url : "/drawings/drawingslist?partno=" + partnovalue })
        }
    });
}

function newDrawingVersion() {

    if (parttree.activeNode === null) {
        alert('You cannot add a new drawing version.  No drawing is selected');
        return ;
    }

    let html = `
    <br>
    <label for="upload">File To Upload:</label>
    <input type="file" id="upload" name="upload"></input>
    <br>`

    $("#dialog-confirm").html(html);
    $("#dialog-confirm").dialog({
        resizable: false,
        modal: true,
        title: "Add Drawing Version",
        height: 240,
        width: 512,
        buttons: {
            "Ok": function () {
                addDrawingVersionToDB();
                $(this).dialog('close');
            },
            "Cancel": function () {
                $(this).dialog('close');
            }
        }
    });
}

function newLink() {
}

function newLinkVersion() {
}

function loadDrawings() {
    let hdr = document.getElementById('drawtitle') ;
    hdr.innerHTML = "<b>Drawings: " + partnovalue + "</b>"

    parttree = new mar10.Wunderbaum({
        id: "partreport",
        debugLevel: 1,
        element: document.getElementById("drawingtable"),
        source: {
            url: "/drawings/drawingslist?partno=" + partnovalue
        },
        columns: [
            { id: "*", title: "Description", width: "160px" },
            { id: "dtype", title: "Type" , width: "120px" },
            { id: "version", title: "Version" , width: "120px" },
            { id: "filename", title: "File/Link Name" },
        ],
        render: function (e) {
            const node = e.node;
            node.tooltip = node.data.desc ;
            for (const col of Object.values(e.renderColInfosById)) {
                col.elem.textContent = node.data[col.id];
            }
        }
    });
}

$(document).ready(loadDrawings);