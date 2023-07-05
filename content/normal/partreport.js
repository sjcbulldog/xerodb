var parttree = null;

document.addEventListener("DOMContentLoaded", (event) => {
    parttree = new mar10.Wunderbaum({
        id: "partreport",
        element: document.getElementById("partreport"),
        source: {
            url: "/audit/partreport"
        },
        columns: [
            { id: "*", title: "Part", width: "160px" },
            { id: "username", title: "User Name" , width: "120px" },
            { id: "ipaddr", title: "IP Address" , width: "120px" },
            { id: "timestamp", title: "When" , width: "200px" },
            { id: "action", title: "Action"},
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
        }
    });
});
