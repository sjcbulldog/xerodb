document.addEventListener("DOMContentLoaded", (event) => {
  new mar10.Wunderbaum({
    id: "demo",
    element: document.getElementById("parttree"),
    source:  {
      url: "/robots/partdata?partno=" + partno
    },
    columns: [
      { id: "*", title: "Part Number", width: "200px" },
      { id: "ntype", title: "Type", width: "120px" },
      { id: "desc", title: "Description", width: "460px" },
      { id: "creator", title: "Created By", width: "180px" },
    ],
    load: function(e) {
      e.tree.expandAll() ;
    },
    render : function(e) {
      // console.log(e.type, e.isNew, e);
      const node = e.node;
      // const util = e.util;
  
      for (const col of Object.values(e.renderColInfosById)) {
        switch (col.id) {
          default:
            // Assumption: we named column.id === node.data.NAME
            col.elem.textContent = node.data[col.id];
            break;
        }
      }
    },
    activate: function(e) {
    },
    dblclick: function(e) {
      window.location.href = "/robots/editpart?partno=" + e.node.key ;
    }
  });
}) ;
