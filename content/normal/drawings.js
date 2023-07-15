let parttree = undefined;

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
            parttree.load({ url: "/drawings/drawingslist?partno=" + partnovalue })
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
        title: "Add Drawing File",
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
    myFormData.append('desc', parttree.activeNode.title);
    myFormData.append('set', parttree.activeNode.data.set);

    $.ajax({
        url: '/drawings/adddrawingversion',
        type: 'POST',
        processData: false, // important
        contentType: false, // important
        dataType: 'json',
        data: myFormData,
        success: function (response, status) {
            parttree.load({ url: "/drawings/drawingslist?partno=" + partnovalue })
        }
    });
}

function newDrawingVersion() {
    if (parttree.activeNode === null || parttree.activeNode.data.dtype !== 'Drawing File') {
        alert('You cannot add a new drawing version.  No drawing is selected');
        return;
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
        title: "Add New Drawing File Version",
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

function addLinkToDB() {
    let link = document.getElementById('link');
    let desc = document.getElementById('desc');
    var myFormData = new FormData();
    myFormData.append('link', link.value);
    myFormData.append('partno', partnovalue);
    myFormData.append('desc', desc.value);

    $.ajax({
        url: '/drawings/addlink',
        type: 'POST',
        processData: false, // important
        contentType: false, // important
        dataType: 'json',
        data: myFormData,
        success: function (response, status) {
            parttree.load({ url: "/drawings/drawingslist?partno=" + partnovalue })
        }
    });
}

function newLink() {
    let html = `
            <br>
            <label for="desc">Description:</label>
            <input type="text" id="desc" name="desc" value=""></input>
            <br>
            <label for="upload">Link To Drawing:</label>
            <input type="url" id="link" name="link"></input>
            <br>`;

    $("#dialog-confirm").html(html);
    $("#dialog-confirm").dialog({
        resizable: false,
        modal: true,
        title: "Add Drawing Link",
        height: 240,
        width: 512,
        buttons: {
            "Ok": function () {
                addLinkToDB();
                $(this).dialog('close');
            },
            "Cancel": function () {
                $(this).dialog('close');
            }
        }
    });
}

function addLinkVersionToDB() {
    let link = document.getElementById('link');
    let desc = document.getElementById('desc');
    var myFormData = new FormData();
    myFormData.append('link', link.value);
    myFormData.append('partno', partnovalue);
    myFormData.append('desc', parttree.activeNode.title);
    myFormData.append('set', parttree.activeNode.data.set);

    $.ajax({
        url: '/drawings/addlinkversion',
        type: 'POST',
        processData: false, // important
        contentType: false, // important
        dataType: 'json',
        data: myFormData,
        success: function (response, status) {
            parttree.load({ url: "/drawings/drawingslist?partno=" + partnovalue })
        }
    });
}

function newLinkVersion() {
    if (parttree.activeNode === null || parttree.activeNode.data.dtype !== 'Drawing Link') {
        alert('You cannot add a new drawing link version.  No drawing link is selected');
        return;
    }
    let html = `
                <br>
                <label for="upload">Link To Drawing:</label>
                <input type="url" id="link" name="link"></input>
                <br>`;

    $("#dialog-confirm").html(html);
    $("#dialog-confirm").dialog({
        resizable: false,
        modal: true,
        title: "Add New Drawing Link Version",
        height: 240,
        width: 512,
        buttons: {
            "Ok": function () {
                addLinkVersionToDB();
                $(this).dialog('close');
            },
            "Cancel": function () {
                $(this).dialog('close');
            }
        }
    });
}

function deleteCurrentFromDB() {
    var myFormData = new FormData();
    myFormData.append('partno', partnovalue);
    myFormData.append('set', parttree.activeNode.data.set);
    myFormData.append('version', parttree.activeNode.data.version);

    $.ajax({
        url: '/drawings/delete',
        type: 'POST',
        processData: false, // important
        contentType: false, // important
        dataType: 'json',
        data: myFormData,
        success: function (response, status) {
            parttree.load({ url: "/drawings/drawingslist?partno=" + partnovalue })
        }
    });
}

function deleteCurrent() {
    if (parttree.activeNode === undefined) {
        alert('Cannot delete drawing file or link.  No link or file is selected.') ;
        return ;
    }

    $("#dialog-confirm").html("Are you sure you want to delete this drawing?");

    // Define the Dialog and its properties.
    $("#dialog-confirm").dialog({
        resizable: false,
        modal: true,
        title: "Delete Part",
        height: 160,
        width: 400,
        buttons: {
            "Yes": function () {
                $(this).dialog('close');
                deleteCurrentFromDB();
            },
            "No": function () {
                $(this).dialog('close');
            }
        }
    });

}

function loadDrawings() {
    let hdr = document.getElementById('drawtitle');
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
            { id: "dtype", title: "Type", width: "120px" },
            { id: "version", title: "Version", width: "120px" },
            { id: "filename", title: "File/Link Name" },
        ],
        render: function (e) {
            const node = e.node;
            node.tooltip = node.data.desc;
            for (const col of Object.values(e.renderColInfosById)) {
                col.elem.textContent = node.data[col.id];
            }
        },
        dblclick: function (e) {
            let set = parttree.activeNode.data.set ;
            let version = parttree.activeNode.data.version ;
            let url = "/drawings/show?partno=" + partnovalue + "&set=" + set + "&version=" + version ;
            window.open(url, '_blank').focus();
        },
    });
}

$(document).ready(loadDrawings);