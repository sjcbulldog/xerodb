function showAllUsers() {
    parttree = new mar10.Wunderbaum({
        id: "partreport",
        debugLevel: 1,
        element: document.getElementById("users"),
        source: {
            url: "/users/allusers"
        },
        columns: [
            { id: "*", title: "User Name", width: "160px" },
            { id: "firstname", title: "First Name", width: "120px" },
            { id: "lastname", title: "Last Name", width: "120px" },
            { id: "rolestr", title: "Roles", width: "120px" },
            { id: "state", title: "State", width: "80px" },
            { id: "email", title: "Email"}
        ],
        render: function (e) {
            const node = e.node;
            node.tooltip = node.data.desc;
            for (const col of Object.values(e.renderColInfosById)) {
                col.elem.textContent = node.data[col.id];
            }
        },
        dblclick: function (e) {
            let username = parttree.activeNode.data.username ;
            let url = "/users/editone?username=" + username ;
            window.location.href = url ;
        },
    });
}

$(document).ready(showAllUsers);