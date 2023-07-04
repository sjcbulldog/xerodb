var parttree = null;

document.addEventListener("DOMContentLoaded", (event) => {
    parttree = new mar10.Wunderbaum({
        id: "userreport",
        element: document.getElementById("userreport"),
        source: {
            url: "/audit/userreport"
        },
        columns: [
            { id: "*", title: "User Name", width: "160px" },
            { id: "ipaddr", title: "IP Address" , width: "120px" },
            { id: "timestamp", title: "When" , width: "200px" },
            { id: "action", title: "Action" },
        ],
        render: function (e) {
            const node = e.node;
            for (const col of Object.values(e.renderColInfosById)) {
                col.elem.textContent = node.data[col.id];
            }
        },
    });
});
