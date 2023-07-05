var parttree = null;

document.addEventListener("DOMContentLoaded", (event) => {
    parttree = new mar10.Wunderbaum({
        id: "assigned",
        element: document.getElementById("assigned"),
        source: {
            url: "/robots/assigned"
        },
        columns: [
            { id: "*", title: "Part Number", width: "220px" },
            { id: "ntype", title: "Type", width: "110px" },
            { id: "quantity", title: "Quantity", width: "80px" },
            { id: "state", title: "State", width: "140px" },
            { id: "desc", title: "Description", /* width: "400px" */},
        ],
        render: function (e) {
            const node = e.node;
            node.tooltip = node.data.desc ;
            for (const col of Object.values(e.renderColInfosById)) {
                col.elem.textContent = node.data[col.id];
            }
        },
        enhanceTitle: function (e) {
            e.titleSpan.title = e.node.data.desc ;
        },
        dblclick: function (e) {
            window.location.href = "/robots/editpart?partno=" + e.node.key + "&parttype=" + e.node.data.ntype;
        }
    });
});
