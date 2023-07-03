$(document).ready(() => {
  $("#parttree").fancytree({
    extensions: ["contextMenu"],
    source: {
      url: "/robots/partdata?partno=" + partno,
      cache: false
    },
    createNode: function (event, data) {
      data.node.expanded = true;
    },
    contextMenu: {
      menu: function (node) {
        var items = [] ;
        items.push({ 'title' : 'Edit', cmd: 'edit'});
        items.push({ 'title' : 'Add Assembly', cmd: 'edit'});
        items.push({ 'title' : 'Add COTS', cmd: 'edit'});
        items.push({ 'title' : 'Add Manufactured', cmd: 'edit'});
        items.push({ 'title' : 'Delete', cmd: 'edit'});
        return items ;
      }
    }
  });
});

