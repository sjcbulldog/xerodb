function initSplitter() {
    var url = document.URL;
    if (url.indexOf('dashboard.html') !== -1) {
        Split(['#menu', '#content'], {
            direction: 'horizontal',
            sizes: [15, 85],
        });
    }
}

$( window ).on( "load", initSplitter );
