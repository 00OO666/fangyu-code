$(function() {
    $.cart = {
        //
        add: function(id,qty) {
            var url = '/api.php?c=cart&f=add&id=' + id;

            var ext = $('.model').val();
            if (ext && ext != 'undefined') {
                url += "&ext=" + ext;
            }

            $.ajax({
                type: "post",
                dataType: "json",
                url: url + '&_t=' + Math.random() * 1000 + 999,
                success: function(msg) {
                    var result = msg.content;
                    if (result.check == 1) {
                        window.location = "index.php?c=cart";
                        return true;
                    }
                    // alert("加入询价车成功。");
                    alert("Join the inquiry cart successfully.");
                    $.cart.total();
                    $.cart.list();
                    // $.cart.check(id);
                }
            });
        },

        total: function() {
            var url = '/api.php?c=cart&f=total2';
            $.ajax({
                'url': url,
                'dataType': 'json',
                'cache': false,
                'success': function(rs) {
                    if (rs.status == 'ok') {
                        rs.content = rs.content || 0;
                        var total = parseInt(rs.content);
                        $(".cart_total").html(total);
                        if (total > 0) { 
                            $(".icon-cart2").attr("class",'has-product');
                        }
                    }
                }
            });
        },
        list: function() {
            var url = '/api.php?c=cart&f=list';
            $.ajax({
                'url': url,
                'dataType': 'json',
                'cache': false,
                'success': function(rs) {
                    if (rs.status == 'ok') {
                        if (!$.isArray(rs.content)) return;
                        var html = '';
                        $.each(rs.content, function(index, el) {
                            // console.dir(el);
                            html += '' +

                                '<li>' +
                                '    <div class="item clearfix">' +
                                '        <div class="pic fl">' +
                                '            <div class="img-box">' +
                                '                <img src="/' + el.thumb.filename + '" class="lazy">' +
                                '            </div>' +
                                '        </div>' +
                                '        <div class="name fl">' +
                                '            <p>' + el.title + '</p>' +
                                '        </div>' +
                                '        <div class="del_btn fr">' +
                                '            <a onclick="$.cart.del(' + el.id + ')"></a>' +
                                '        </div>' +
                                '    </div>' +
                                '</li>'

                        });
                        // console.log(html);
                        $("#inquiry-item-list").html(html);
                    }
                }
            });
        },
        del: function(id) {
            var remove_id = "#product_remove_" + id;
            var url = '/api.php?c=cart&f=delete&id=' + id;
            $.ajax({
                'url': url,
                'dataType': 'json',
                'cache': false,
                'success': function(rs) {
                    if (rs.status == 'ok') {
                        window.location.reload();
                        return true;
                    }
                }
            });
        },
        check: function(id) {
            var url = '/api.php?c=cart&f=check&id=' + id;
            $.ajax({
                'url': url,
                'dataType': 'json',
                'cache': false,
                'success': function(rs) {
                    if (rs.status == 'ok') {
                        $("#addCart").css("background-image", "url(images/enter_inquiry.png)");
                    }
                }
            });
        }

    };
});
$(document).ready(function() {
    $.cart.total();
    $.cart.list();

    $('.number-box').on('input propertychange', '.ipt-num', function(event) {

        var url = '/api.php?c=cart&f=qty&id=' + $(this).data('id') + '&qty=' + $(this).val();

            $.ajax({
                type: "get",
                dataType: "json",
                url: url + '&_t=' + Math.random() * 1000 + 999,
                success: function(msg) {
                    // var result = msg.content;
                    // if (result.check == 1) {
                    //     window.location = "index.php?c=cart";
                    //     return true;
                    // }
                    // alert("This product has been added to Inquiry.");
                    // $.cart.total();
                    // $.cart.list();
                    // $.cart.check(id);
                }
            });

    });


    $(".hook-inpu-note").change(function (){
        var url = '/api.php?c=cart&f=note&id=' + $(this).data('id') + '&note=' + $(this).val();

            $.ajax({
                type: "get",
                dataType: "json",
                url: url + '&_t=' + Math.random() * 1000 + 999,
                success: function(msg) {
                }
            });

    });

});


$(function () {
    $('.form_cart').on('click', '.send_cart', function (event) {
        event.preventDefault();
        var jForm = $(event.delegateTarget),
            jThis = $(this);
        if (jThis.hasClass('disabled')) {
            alert('Please wait...');
            return;
        }

        var reg_email = /^[_a-z0-9-]+(\.[_a-z0-9-]+)*@[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,})$/;
        // var reg_tel = /^(\(\d{3,4}\)|\d{3,4}-|\s)?\d{7,14}$/;

        var data = {
            id: 'book', _spam: '{$session.project_spam}',
            title: $('input[name="title"]', jForm).val().trim(),
            fullname: $('input[name="fullname"]', jForm).val().trim(),
            email: $('input[name="email"]', jForm).val().trim(),
            content: $('textarea[name="content"]', jForm).val().trim(),
        };

        if (!data.email || !reg_email.test(data.email)) {
            alert('Please enter a valid email address.');
            // alert('请输入一个有效的邮箱地址。');
            $('input[name="email"]', jForm).focus();
            return false;
        } else if (!data.title) {
            alert('The title cannot be empty.');
            // alert('请输入留言主题。');
            $('input[name="title"]', jForm).focus();
            return false;
        } else if (!data.content) {
            alert('The message cannot be empty.');
            // alert('请输入留言内容。');
            $('textarea[name="content"]', jForm).focus();
            return false;
        } else if (!data.fullname) {
            alert('The name cannot be empty.');
            // alert('请输入姓名。');
            $('input[name="fullname"]', jForm).focus();
            return false;
        }

        jThis.css({opacity: '.5'}).addClass('disabled');

        if (jForm.hasClass('form_cart')) {
            var url = '/index.php?c=cart&f=sendMessage&t=' + new Date().getTime();
        }

        $.ajax({
            'url' : url,
            'data': jForm.serializeArray(),
            'type' : 'post',
            'dataType' : 'json',
            'success' : function (rs) {
                jThis.css({opacity: '1'}).removeClass('disabled');
                if (rs.status == 'ok') {
                    alert('Your message has been posted, please wait patiently administrator audit, thank you for your submission.');
                    // alert('您的留言已提交,请耐心等候管理员回复');
                    if (jForm.hasClass('form_cart')) {
                        location.href = '/index.html';
                    } else {
                        jForm.get(0).reset();
                    }
                } else {
                    alert(rs.content);
                    return false;
                }
            }
        });
        return false;
    });
});
