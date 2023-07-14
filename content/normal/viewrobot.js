var parttree = null;
var drawingWin = false;

function showDrawingWindow() {
    if (parttree === null || parttree.activeNode === null)
        return;

    let html = `
    <div>
        <div style="width: 50%; float: left;">
            <b>Files:</b></br>
            <select id="files" multiple size=4 style="width: 240px;"></select>
            <input type="button" id="deletefile" name="deletefile" value="Delete"></input>
        </div>
        <div style="width: 50%; float: left;">
            <b>Links:</b><br>
            <select id="files" multiple size=4 style="width: 240px;"></select>
            <input type="button" id="deletelink" name="deletelink" value="Delete"></input>
        </div>
    </div>
    <div style="margin-bottom: 10px;">&nbsp;</div>
    <hr>
    <b>New Drawing File</b>
    <br>
    <label for="desc">Description:</label>
    <input type="text" id="desc" name="desc" value=""></input>
    <br>
    <label for="upload">File To Upload:</label>
    <input type="file" id="upload" name="upload"></input>
    <br>
    <input type="button" id="doupload" name="doupload" value="Upload"></input>` ;

    $("#dialog-confirm").html(html);

    document.getElementById('doupload').addEventListener('click', function (e) {
        var filesel = document.getElementById('upload');
        var desc = document.getElementById('desc');
        if (filesel.value.length === 0) {
            alert("No file has been selected.  You must select a file to upload a new drawing for a part.");
        }
        else if (desc.length === 0) {
            alert("No description was provided for the new drawing file.  A description is required.");
        }
        else {
            var myFormData = new FormData();
            myFormData.append('drawing', filesel.files[0]);
            myFormData.append('partno', parttree.activeNode.key);
            myFormData.append('desc', desc.value);

            $.ajax({
                url: '/robots/adddrawing',
                type: 'POST',
                processData: false, // important
                contentType: false, // important
                dataType: 'json',
                data: myFormData
            });
        }
    });

    drawingWin = true;
    $("#dialog-confirm").dialog({
        resizable: false,
        modal: true,
        title: "Edit Drawings",
        height: 384,
        width: 576,
        buttons: {
            "Close": function () {
                $(this).dialog('close');
                drawingWin = false ;
            }
        }
    });
}

function updateCosts() {
    $.getJSON('/robots/totalcost?robotid=' + robotid, (data) => {
        if (data.total !== undefined) {
            const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
            $("#costs").html('Total Robot Cost: ' + formatter.format(data.total));
        }
        else {
            $("#costs").html('Error Computing Robot Costs');
        }
    });
}

document.addEventListener("DOMContentLoaded", (event) => {
    parttree = new mar10.Wunderbaum({
        id: "demo",
        element: document.getElementById("parttree"),
        source: {
            url: "/robots/robotdata?robotid=" + robotid
        },
        columns: [
            { id: "*", title: "Part Number", width: "300px" },
            { id: "student", title: "Student", width: "90px" },
            { id: "mentor", title: "Mentor", width: "90px" },
            { id: "ntype", title: "Type", width: "110px" },
            { id: "quantity", title: "Quantity", width: "70px" },
            { id: "state", title: "State", width: "200px" },
            { id: "desc", title: "Description", /* width: "400px" */ },
        ],
        load: function (e) {
            e.tree.expandAll();
            updateCosts();
        },
        render: function (e) {
            const node = e.node;
            for (const col of Object.values(e.renderColInfosById)) {
                col.elem.textContent = node.data[col.id];
            }
        },
        dnd: {
            dragStart: (e) => {
                if (/[0-9][0-9][0-9]-0001/.test(e.node.key)) {
                    return false;
                }
                if (e.event.ctrlKey)
                    e.event.dataTransfer.effectAllowed = "copy";
                else
                    e.event.dataTransfer.effectAllowed = "move";
                return true;
            },
            dragEnter: (e) => {
                if (e.node.data.ntype.startsWith('A')) {
                    return "over";
                }
                else {
                    return null;
                }
            },
            drop: (e) => {
                if (e.event.ctrlKey)
                    window.location.href = "/robots/copypart?partno=" + e.sourceNode.key + "&parent=" + e.node.key;
                else
                    window.location.href = "/robots/reparentpart?partno=" + e.sourceNode.key + "&parent=" + e.node.key;

                updateCosts();
            },
        },
        dblclick: function (e) {
            window.location.href = "/robots/editpart?partno=" + e.node.key + "&parttype=" + e.node.data.ntype + "&retplace=/robots/viewrobot$$$ROBOTID$$$";
        },
        enhanceTitle: function (e) {
            e.titleSpan.title = e.node.data.desc;
        },
    });
});

document.onkeydown = function (e) {
    if (parttree === null || parttree.activeNode === null || drawingWin === true)
        return;

    if (parttree.activeNode.key) {
        console.log(e.key);
        if (e.key === 'c' || e.key === 'C') {
            window.location.href = "/robots/newpart?parent=" + parttree.activeNode.key + "&type=C&abbrev=";
        }
        else if (e.key === 'r' || e.key === 'R') {
            if (!parttree.activeNode.data.ntype.startsWith('A')) {
                alert('You can only rename an assembly');
                return;
            }

            while (true) {
                abbrev = window.prompt('Enter Abbreviation For This Assembly (leave blank to inherit from parent)');
                if (abbrev === null) {
                    return;
                }

                if (abbrev.length === 0 || /^[a-zA-Z]+$/.test(abbrev)) {
                    break;
                }

                alert('Abbreviations for assemblies must be all letters');
            }

            // Rename the assembly name
            window.location.href = "/robots/rename?partno=" + parttree.activeNode.key + "&abbrev=" + abbrev;

        } else if (e.key === 'a' || e.key === 'A') {
            let abbrev = '';
            while (true) {
                abbrev = window.prompt('Enter Abbreviation For This Assembly (leave blank to inherit from parent)');
                if (abbrev === null) {
                    return;
                }

                if (abbrev.length === 0 || /^[a-zA-Z]+$/.test(abbrev)) {
                    break;
                }

                alert('Abbreviations for assemblies must be all letters');
            }
            window.location.href = "/robots/newpart?parent=" + parttree.activeNode.key + "&type=A&abbrev=" + abbrev;
        }
        if (e.key === 'm' || e.key === 'M') {
            window.location.href = "/robots/newpart?parent=" + parttree.activeNode.key + "&type=M&abbrev=";
        }
        else if (e.key === 'd' || e.key === 'D') {
            showDrawingWindow();
        }
        else if (e.key === 'Delete') {
            if (parttree.activeNode.key === '001-COMP-00001' || parttree.activeNode.key === '001-PRAC-00001') {
                alert('You cannot delete the top most comp bot or practice bot.');
                return;
            }

            $("#dialog-confirm").html("Are you sure you want to delete this part (" + parttree.activeNode.key + ")?");

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
                        window.location.href = "/robots/deletepart?partno=" + parttree.activeNode.key;
                    },
                    "No": function () {
                        $(this).dialog('close');
                    }
                }
            });
        }
    }
}
