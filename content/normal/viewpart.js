
$(document).ready(() => {
    $("#parttree").fancytree({
        source: {
          url: "/robots/partdata?partno=" + partno,
          cache: false
        },
        createNode: function(event, data) {
          data.node.expanded = true ;
        }
    });

    var tree = $.ui.fancytree.getTree("#parttree");
    tree.expandAll() ;
});

