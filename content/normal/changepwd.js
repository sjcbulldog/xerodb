function generatePasswordForm() {
    $.getJSON('/users/userinfo', (data) => {
        let content = '<form id="changepwd" method="post" action="/users/changepwd" enctype="application/x-www-form-urlencoded">' ;

        content += '<div>';
        content += '<input type="hidden" id="username" name="username" value="' + usernamevalue + '"/>' ;
        content += '</div>';

        content += '<div>';
        content += '<input type="password" placeholder="Old Password" required="true" id="oldpwd" name="oldpwd"/>' ;
        content += '</div>';

        content += '<div>';
        content += '<input type="password" placeholder="New Password" required="true" id="newpwd" name="newpwd"/>' ;
        content += '</div>';

        content += '<div>';
        content += '<input type="password" placeholder="Repeate New Password" required="true" id="secondpwd" name="secondpwd"/>' ;
        content += '</div>';

        content += '<div>'
        content += '<input type="submit" value="Change" />' ;
        content += '</div>' ;
        content += '</form>' ;

        $('.app').append(content) ;
    }) ;
}

$(document).ready(() => {
    generatePasswordForm();

    $(document).on('submit', this, (e) => {

    }) ;
});
