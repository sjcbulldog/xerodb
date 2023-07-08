var parttree = null;

function updateCosts() {
    $.getJSON('/robots/totalcost?robotid=' + robotid, (data) => {
        if (data.total !== undefined) {
            const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD'}) ;
            $("#costs").html('Total Robot Cost: ' + formatter.format(data.total));
        }
        else {
            $("#costs").html('Error Computing Robot Costs') ;
        }
    }) ;
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
            { id: "state", title: "State", width: "100px" },
            { id: "desc", title: "Description", /* width: "400px" */},
        ],
        load: function (e) {
            e.tree.expandAll();
            updateCosts() ;
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
                    e.event.dataTransfer.effectAllowed = "copy" ;
                else 
                    e.event.dataTransfer.effectAllowed = "move" ;
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

                updateCosts() ;
            },
        },
        activate: function (e) {
        },
        dblclick: function (e) {
            window.location.href = "/robots/editpart?partno=" + e.node.key + "&parttype=" + e.node.data.ntype;
        },
        enhanceTitle: function (e) {
            e.titleSpan.title = e.node.data.desc ;
        },
    });
});

document.onkeydown = function (e) {
    if (parttree === null) {
        return;
    }

    if (parttree.activeNode === null) {
        return;
    }

    if (parttree.activeNode.key) {
        console.log(e.key);
        if (e.key === 'c' || e.key === 'C') {
            window.location.href = "/robots/newpart?parent=" + parttree.activeNode.key + "&type=C&abbrev=";
        }
        else if (e.key === 'a' || e.key === 'A') {
            let abbrev = '' ;
            while (true) {
                abbrev = window.prompt('Enter Abbreviation For This Assembly (leave blank to inherit from parent)');
                if (abbrev === null) {
                    return ;
                }

                if (abbrev.length === 0 || /[a-zA-Z]+/.test(abbrev)) {
                    break ;
                }

                alert('Abbreviations for assemblies must be all letters') ;
            }
            window.location.href = "/robots/newpart?parent=" + parttree.activeNode.key + "&type=A&abbrev=" + abbrev ;
        }
        if (e.key === 'm' || e.key === 'M') {
            window.location.href = "/robots/newpart?parent=" + parttree.activeNode.key + "&type=M&abbrev=";
        }
        else if (e.key === 'Delete') {
            if (parttree.activeNode.key === '001-COMP-00001' || parttree.activeNode.key === '001-PRAC-00001') {
                alert('You cannot delete the top most comp bot or practice bot.');
                return ;
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
