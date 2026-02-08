// $(function () {



//     var circlr = $(".rotation");
//     if (circlr.length){

//         console.log(123);
        
//         $(window).on("load", function () {
//             circlr.show();
//         });

//     };
   
// });


// 表格
$(function () {
    var oTable = $("table");
    if (oTable.length !== 0) {
        var oTr = oTable.find("tr"),
            oTd = oTable.find("td");
        oTable.wrap("<div class='table-box'></div>");
        oTr.attr("style", "");
        oTd.each(function (index) {
            if (typeof $(this).attr("style") !== "undefined") {
                if ($(this).attr("style").indexOf("text-align: center") >= 0) {
                    $(this).attr("style", "text-align: center");
                } else {
                    $(this).attr("style", "");
                }
            }
        });
    }
});

$(function () {
    var circlr = $('.rotation');
    if (!circlr.length) return;
    $(window).on('load', function () {
        circlr.show();
    });
});


$(function () {
    $(".prodeta-info-list").slick({
        slidesToShow: 3,
        autoplay: true,
        autoplaySpeed: 5000,
        speed: 1000,
        responsive: [
            {
                breakpoint: 991,
                settings: {
                    slidesToShow: 2,
                },
            },
            {
                breakpoint: 768,
                settings: {
                    slidesToShow: 1,
                },
            },
        ],
    });

    $(".prodeta-related-list").slick({
        slidesToShow: 3,
        dots: true,
        lazyLoad: "anticipated",
        autoplay: true,
        autoplaySpeed: 5000,
        speed: 1000,
        responsive: [
            {
                breakpoint: 991,
                settings: {
                    slidesToShow: 2,
                },
            },
            {
                breakpoint: 768,
                settings: {
                    slidesToShow: 1,
                },
            },
        ],
    });

    inquireInfo(".inquiry-btn", ".prodeta-inquiry");

    inquireInfo(".prodeta-overview .mores", ".prodeta-inquiry");


});
function inquireInfo(btnClick, form, setTop = 85) {
    $(btnClick).click(function () {
        let offsetTop = $(form).offset().top;
        $("body,html").animate({
            scrollTop: offsetTop - $(".header").height() - setTop + "px",
        });
    });
}
