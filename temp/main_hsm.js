/**
 * 通用模块
 */
var $win = $(window),
  $doc = $(document),
  $body = $("body"),
  winW = $win.width(),
  header = $(".header"),
  nav = $(".nav"),
  banner = $(".banner"),
  translateEl = $(".google-translate");

function ismobile() {
  return !!~navigator.userAgent.indexOf("Mobile");
}

ismobile() ? $body.addClass("mobile") : $body.addClass("pc");

$win.resize(function () {
  winW = $win.width();
});

//图片加载
// $(function () {
//     if (!$.fn.lazyload) return;
//     $('.lazy', $body).lazyload({
//         effect: 'fadeIn',
//         threshold: $win.outerHeight() * 0.6,
//         // skip_invisible: true,
//         failurelimit: 9999999,
//         load: function () {
//             $(this).removeClass('lazy');
//         },
//     });
// });
$(function () {
  // var callback_loaded = function (element) {
  // };
  $('[data-bg-src]').each((_, el) => {
      $(el).attr('data-bg', $(el).data('bg-src'));
  });

  myLazyLoad = new LazyLoad({
    // container: document.getElementById('body'),
    thresholds: "120% 0px",
    // Assign the callbacks defined above
    // callback_enter: callback_enter,
    // callback_exit: callback_exit,
    // callback_cancel: callback_cancel,
    // callback_loading: callback_loading,
    // callback_loaded: callback_loaded,
    // callback_error: callback_error,
    // callback_finish: callback_finish
  });
});

//加载完成
$(function () {
  $body.addClass("loaded");
  // $win.on('load', function () {
  // });
});

//元素懒加载--调用
// $(function () {
//     var elem = $('.lazy-elem');

//     if (!elem.length) return;

//     var oset = null;

//     function isInViewPort(element) {
//         var viewHeight = $win.height();
//         var elData = element.getBoundingClientRect();
//         return elData.top <= viewHeight;
//     }

//     function scrollHandler() {
//         if (!elem.length) return;

//         elem.each(function (index, element) {
//             var _this = $(this);

//             if (isInViewPort(_this[0]) && !_this.attr('src')) {
//                 _this.attr('src', _this.attr('data-src')).removeClass('lazy-elem');

//                 elem = elem.filter('.lazy-elem');
//             }
//         });
//     }

//     scrollHandler();

//     $win.on('scroll', function () {
//         clearTimeout(oset);

//         oset = setTimeout(function () {
//             scrollHandler();
//         }, 20);
//     });
// });

//wow
$(function () {
  if ($(".wow").length) {
    var wow = new WOW({
      boxClass: "wow",
      animateClass: "animated",
      offset: 20,
      mobile: false,
      live: true,
    });
    wow.init();
  }
});

//头部导航
$(function () {
  //折叠导航

  header.on("click", ".nav-collapse", function (e) {
    $(".nav-collapse").toggleClass("active");

    nav.toggleClass("fade-out");
    $body.toggleClass("fixed");
  });

  //查找按钮
  var search = $(".search-wrap"),
    findEl = $(".find");
  findEl.click(function (e) {
    if (search.hasClass("active")) {
      search.hide().removeClass("active");
    } else {
      search.stop().fadeIn().addClass("active").find(".input-text").focus();
    }
  });
  $(".search-close").click(function (e) {
    search.hide().removeClass("active");
  });

  if (search.is(":visible")) return;
  $body
    .on("keydown", function (e) {
      if (search.hasClass("active") && e.keyCode == 27) {
        search.hide().removeClass("active");
      }
    })
    .on("click", function (e) {
      if (
        !$(e.target).closest(".find").length &&
        !$(e.target).closest(".search-wrap").length
      ) {
        search.hide().removeClass("active");
      }
    });
});

//导航
$(function () {
  var list1 = $(".nav-list1");

  list1.find("li").each(function () {
    var _this = $(this);
    // _this.children('ul').children('li').length && _this.addClass('more');
    _this.children("ul").find("li").length && _this.addClass("more");
  });

  nav.on("click", "li.more >span", function (event) {
    if (winW > 1199) return;
    event.stopPropagation();
    var $this = $(this),
      $this_parent = $this.parent();

    event.target.localName !== "a" &&
      ($this_parent.hasClass("current")
        ? $this_parent.removeClass("current")
        : $this_parent
            .addClass("current")
            .siblings(".current")
            .removeClass("current"));
  });
});

//导航浮动
$(function () {
  var oset = null,
    $header = $(".header"),
    $headerBox = $header.find(".header-box"),
    // $headerBox = $header.find('.btm-nav'),
    // navH = $('.index-body').length ? 0 : $headerBox.height(),
    // navH = $headerBox.height(), //获取导航高度
    navH = $header.height(), //获取导航高度
    navT = $header.hasClass("always-fixed") ? 0 : $header.offset().top + navH; //获取导航距离顶部的高度
  // navT = $headerBox.offset().top + navH; //获取导航距离顶部的高度
  // navT = 0; //获取导航距离顶部的高度

  const floorNav = $(".floor-nav");

  if (ismobile()) {
    var lastScrollTop = 0;
    function checkScroll() {
      var currentScrollTop = $win.scrollTop();
      if (currentScrollTop > lastScrollTop) {
        // Scrolling down
        $header.removeClass("mobie-fixed").height("auto");
      } else {
        if (currentScrollTop > navT) {
          // Scrolling up
          $header.addClass("mobie-fixed").height(navH);
        } else {
          $header.removeClass("mobie-fixed").height("auto");
        }
      }
      lastScrollTop = currentScrollTop;
    }

    // $win.on('load scroll ', checkScroll);
    $win.on("load scroll", function () {
      clearTimeout(oset);
      oset = setTimeout(checkScroll, 50);
    });
  } else {
    function fixedNav() {
      $win.on("load scroll", function () {
        clearTimeout(oset);
        oset = setTimeout(function () {
          if ($win.scrollTop() > navT) {
            $header.addClass("fixed").height(navH);
          } else {
            $header.removeClass("fixed").height("auto");
          }

          floorNav.length && floorNav.css("top", $headerBox.height());
        }, 50);
      });
    }

    if (document.fonts) {
      document.fonts.ready.then(function () {
        fixedNav();
      });
    } else {
      $win.on("load", function () {
        fixedNav();
      });
    }
  }
});

// $(function () {
//     if (ismobile()) return;

//     function fixedNav() {
//         var oset = null,
//             nav = $('.header'),
//             slideNav = nav.find('.header-box'),
//             // slideNav = nav.find('.btm-nav'),
//             // navH = $('.index-body').length ? 0 : slideNav.height(),
//             // navH = slideNav.height(), //获取导航高度
//             navH = nav.height(), //获取导航高度
//             // navT = slideNav.offset().top + navH; //获取导航距离顶部的高度
//             navT = 0; //获取导航距离顶部的高度

//         // nav.height(navH);

//         $win.on('load scroll', function () {
//             clearTimeout(oset);
//             oset = setTimeout(function () {
//                 if ($win.scrollTop() > navT) {
//                     nav.addClass('fixed').height(navH);
//                 } else {
//                     nav.removeClass('fixed').height('auto');
//                 }
//             }, 50);
//         });
//     }

//     if (document.fonts) {
//         document.fonts.ready.then(function () {
//             fixedNav();
//         });
//     } else {
//         $win.on('load', function () {
//             fixedNav();
//         });
//     }
// });

//index-banner
$(function () {
  if (!banner.length) return;

  var interleaveOffset = 0.6,
    highestAspectRatio = 0,
    videoElements = $(".banner-video"),
    hasVideo = videoElements.length > 0;

  // 获取实际幻灯片数量，决定是否启用循环
  var slideCount = banner.find(".swiper-slide").length;
  var enableLoop = slideCount > 1;

  var swiper = new Swiper(".banner", {
    loop: enableLoop,
    loopedSlides: enableLoop ? 1 : 0,
    slidesPerView: 1,
    speed: 1000,
    autoHeight: false,
    autoplay: enableLoop ? {
      delay: 5000,
      disableOnInteraction: false,
    } : false,
    lazy: {
      loadPrevNext: true,
      loadOnTransitionStart: true,
    },
    pagination: {
      el: ".banner-swiper-pagination",
      clickable: true,
      renderBullet: function (index, className) {
        // return '<span class="' + className + '">' + (index + 1) + '</span>';
        return (
          '<span class="' +
          className +
          '"><span class="num">' +
          ("0" + (index + 1)).slice(-2) +
          "</span></span>"
        );
      },
    },
    navigation: {
      nextEl: ".banner-button-next",
      prevEl: ".banner-button-prev",
    },
    watchSlidesProgress: true,
    on: {
      progress: function (swiper) {
        for (var i = 0; i < swiper.slides.length; i++) {
          var slideProgress = swiper.slides[i].progress;
          var innerOffset = swiper.width * interleaveOffset;
          var innerTranslate = slideProgress * innerOffset;
          swiper.slides[i].querySelector(".item").style.transform =
            "translate3d(" + innerTranslate + "px, 0, 0)";
        }
      },
      touchStart: function (swiper) {
        for (var i = 0; i < swiper.slides.length; i++) {
          swiper.slides[i].style.transition = "";
        }
      },
      setTransition: function (swiper, speed) {
        for (var i = 0; i < swiper.slides.length; i++) {
          swiper.slides[i].style.transition = speed + "ms";
          swiper.slides[i].querySelector(".item").style.transition =
            speed + "ms";
        }
      },

      init: function (swiper) {},
      // slideChange: function () {
      //     $list.eq(this.realIndex).addClass('active').siblings().removeClass('active');
      // },
      lazyImageReady: function (swiper, slide, image) {
        if (!hasVideo) return;
        // if (!hasVideo || isObtainImgWH) return;
        var imgH = image.height,
          imgW = image.width,
          aspectRatio = (imgH / imgW) * 100;

        if (aspectRatio > highestAspectRatio) {
          highestAspectRatio = aspectRatio;
          videoElements
            .closest(".banner-video-box")
            .css("padding-bottom", highestAspectRatio + "%");
        }

        // isObtainImgWH = true;
      },
    },
  });

  if (hasVideo) {
    var fluidPlayers = [];

    videoElements.each(function (index, videoElement) {
      var _this = $(this);
      var posterUrl = _this.attr("poster"),
        videoUrl = _this.children("source").attr("src");
      if (!ismobile()) {
        var player = fluidPlayer(videoElement.id, {
          layoutControls: {
            fillToContainer: true,
            autoPlay: false,
            playButtonShowing: true,
            posterImage: posterUrl,
            loop: false,
            mute: true, // Default false
            layoutControls: {},
            controlBar: {
              autoHide: true,
              autoHideTimeout: 3,
              animated: true,
            },
          },
          // captions: {
          // 	play: '播放',
          // 	pause: '暂停',
          // 	mute: '静音',
          // 	unmute: '取消静音',
          // 	fullscreen: '全屏',
          // 	exitFullscreen: '退出全屏'
          // }
        });

        fluidPlayers[_this.closest(".swiper-slide").index()] = player;

        player.on("ended", function () {
          var nextIndex = (swiper.realIndex + 1) % swiper.slides.length;
          var nextVideoElement = checkIfSlideContainsVideo(nextIndex);
          swiper.slideTo(nextIndex);
          if (nextVideoElement) {
            swiper.autoplay.stop();
          } else {
            swiper.autoplay.start();
          }
        });
      } else {
        var mobileVideoImg =
            '<div class="mobile-video" data-fancybox data-src="' +
            videoUrl +
            '"><img src="' +
            posterUrl +
            '" alt="' +
            _this.data("alt") +
            '" /></div>',
          wrapEl = _this.parent().parent();

        wrapEl.html(mobileVideoImg);
      }
    });

    function checkIfSlideContainsVideo(index) {
      return !!fluidPlayers[index];
    }

    function handleVideoPlay(video) {
      swiper.autoplay.stop();
      video.play();
    }

    function handleVideoPause(video) {
      video.pause();
    }

    function initialCheckAndPlay() {
      // var currentSlideIndex = swiper.realIndex;
      if (checkIfSlideContainsVideo(0)) {
        handleVideoPlay(fluidPlayers[0]);
        banner.addClass("hide-arrow");
      } else {
        banner.removeClass("hide-arrow");
      }
    }

    swiper.on("slideChange", function () {
      var currentSlideIndex = swiper.realIndex;
      var prevSlideIndex = swiper.previousIndex;

      if (checkIfSlideContainsVideo(currentSlideIndex)) {
        handleVideoPlay(fluidPlayers[currentSlideIndex]);
        banner.addClass("hide-arrow");
      } else {
        banner.removeClass("hide-arrow");
      }

      if (checkIfSlideContainsVideo(prevSlideIndex)) {
        handleVideoPause(fluidPlayers[prevSlideIndex]);
      }
    });
    // Initial check
    initialCheckAndPlay();

    banner
      .on("mouseenter", ".fluid_controls_container", function (e) {
        swiper.allowTouchMove = false;
      })
      .on("mouseleave", ".fluid_controls_container", function (e) {
        swiper.allowTouchMove = true;
      });
  }
});

//千位分隔符
function thousandBitSeparator(num) {
  return (num || 0).toString().replace(/(\d)(?=(?:\d{3})+$)/g, "$1,");
}

//数字滚动
$(function () {
  var $timer = $(".num-box"),
    winH = $win.height(),
    countFinish = false;
  if (!$timer.length && !$(".index-box").length) return;
  function scrollHandler() {
    if (!$timer.length) return;
    var top = $timer.offset().top;

    !countFinish && $timer.css("opacity", 0);
    if (top > $win.scrollTop() + winH || countFinish) return;

    $timer.css("opacity", 1);

    $win.off("scroll", scrollHandler);
    $(".timer", $timer).countTo({
      //						decimals: 2,
      formatter: function (value, options) {
        var num = value.toFixed(options.decimals);

        var _this = $(this);
        // if (!$('.about-wrap').length && $(this).parents('li').index() !== 0) {
        if (_this.parents("li").index() === 0) {
          return num;
        } else {
          return thousandBitSeparator(num);
        }
      },
    });
    countFinish = true;
  }
  scrollHandler();
  $win.on("load scroll", scrollHandler);
});

//在线客服
$(function () {
  var code = $(".code-pic");

  $(".online .code")
    .on("mouseenter", function () {
      if (ismobile()) {
        $(this).children(".code-pic").stop(true, true).fadeIn();
      } else {
        $(this).children(".mask").stop(true, true).fadeIn();
      }
    })
    .on("mouseleave", function () {
      if (ismobile()) {
        $(this).children(".code-pic").stop(true, true).fadeOut();
      } else {
        $(this).children(".mask").stop(true, true).fadeOut();
      }
    });

  code
    .on("mouseenter", function (e) {
      $(this).stop(true, true).fadeIn();
    })
    .on("mouseleave", function () {
      $(this).stop(true, true).fadeOut();
    });

  const $onlineWrap = $(".online-wrap"),
    $onlineBtn = $(".online-btn"),
    $onlineCont = $(".online");

  $onlineBtn.on("click", function () {
    $(this).toggleClass("active");
    $onlineCont.toggleClass("active");
  });

  // var onlineSet = null;
  // if (ismobile()) {
  //     $onlineBtn.on('click', function () {
  //         $(this).toggleClass('active');
  //         $onlineCont.toggleClass('active');
  //     });
  // } else {
  //     $onlineBtn.on('mouseenter', function () {
  //         $onlineCont.addClass('active');
  //         onlineSet && clearTimeout(onlineSet);
  //         onlineSet = setTimeout(function () {
  //             $onlineCont.removeClass('active');
  //         }, 3000);
  //     });

  //     $onlineCont
  //         .on('mouseenter', function () {
  //             onlineSet && clearTimeout(onlineSet);
  //         })
  //         .on('mouseleave', function () {
  //             onlineSet && clearTimeout(onlineSet);
  //             onlineSet = setTimeout(function () {
  //                 $onlineCont.removeClass('active');
  //             }, 3000);
  //         });
  // }

  if ($onlineWrap.find(".cart").length) {
    var set = null;
    $(".add-btn").on("click", function () {
      if (winW > 767) return false;
      $onlineBtn.trigger("click");

      set && clearTimeout(set);
      set = setTimeout(function () {
        $onlineBtn.trigger("click");
      }, 3000);
    });
  }

  var $goTopButton = $(".gotop");
  var scrollTimeout;

  // Toggle button visibility based on scroll position with debounce
  $win.on("load scroll", function () {
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }
    scrollTimeout = setTimeout(function () {
      $goTopButton.toggleClass("is-show", $win.scrollTop() > 500);
    }, 100); // Adjust the debounce time as needed
  });
});

const scrollToTop = () => {
  window.scrollTo({top: 0, left: 0});
};

const scrollToElem = (e) => {
  var targetElement = document.getElementById(e);

  if (targetElement) {
    var scrollPaddingTop = parseInt(
      window.getComputedStyle(document.documentElement)["scroll-padding-top"]
    );

    function getOffsetTopRelativeToPage(element) {
      const rect = element.getBoundingClientRect();
      return rect.top + window.scrollY;
    }

    var scrollPosition =
      getOffsetTopRelativeToPage(targetElement) - scrollPaddingTop;

    window.scrollTo({
      top: scrollPosition,
      behavior: "smooth",
    });
  }
};

// 导航产品
$(function () {
  const $list = $(".list-name"),
    $list1 = $(".list-name1"),
    $navProduct = $(".nav-product"),
    $proList = $(".pro-xl-list");

  $navProduct
    .on("mouseenter", function () {
      $proList.stop().fadeIn();
    })
    .on("mouseleave", function () {
      $proList.stop().fadeOut();
    });

  $proList
    .on("mouseenter", function () {
      $(this).stop().fadeIn();
    })
    .on("mouseleave", function () {
      $(this).stop().fadeOut();
    });

  $list
    .on("mouseenter", ">li", function () {
      var $this = $(this),
        listH = $list.outerHeight(true),
        listIntro = $this.children(".list-intro");

      $this.addClass("active");

      // var introHeight = listIntro.outerHeight(true) > listH ? listIntro.outerHeight(true) : 'auto';

      // listIntro.show();
      // $this.siblings().find(".list-intro").hide();
      // $list1.height(introHeight);
    })
    .on("mouseleave", ">li", function () {
      var $this = $(this);
      $this.removeClass("active");
      $this.find(".active").removeClass("active");
    });
});

//index-app
$(function () {
  var applications = $(".index-applications-list");

  if (!applications.length || winW < 1200) return;

  applications
    .on("mouseenter", ".item", function () {
      $(this).find(".txt").stop().slideDown();
    })
    .on("mouseleave", ".item", function () {
      $(this).find(".txt").stop().slideUp();
    });
});

//partners
$(function () {
  var partners = $(".slick-partners");

  if (!partners.length) return;

  partners.slick({
    autoplay: true,
    autoplaySpeed: 3000,
    infinite: false,
    fade: false,
    // arrows: true,
    dots: false,
    slidesToShow: 7,
    slidesToScroll: 1,
    centerMode: false, //居中视图   slidesToShow为双数的时候慎用
    touchThreshold: 300,
    lazyLoad: "ondemand",
    // appendArrows: '.honor-arrow',
    adaptiveHeight: false,
    pauseOnHover: false,
    responsive: [
      {
        breakpoint: 1400,
        settings: {
          slidesToShow: 6,
        },
      },
      {
        breakpoint: 1200,
        settings: {
          slidesToShow: 5,
        },
      },
      {
        breakpoint: 992,
        settings: {
          slidesToShow: 4,
        },
      },
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 3,
        },
      },
    ],
  });
});

//news
$(function () {
  var news = $(".slick-index-news");

  if (!news.length) return;

  news.slick({
    autoplay: true,
    autoplaySpeed: 5000,
    infinite: false,
    fade: false,
    // arrows: true,
    dots: false,
    slidesToShow: 3,
    slidesToScroll: 1,
    centerMode: false, //居中视图   slidesToShow为双数的时候慎用
    touchThreshold: 300,
    lazyLoad: "ondemand",
    // appendArrows: '.honor-arrow',
    adaptiveHeight: false,
    pauseOnHover: false,
    responsive: [
      {
        breakpoint: 992,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 2,
        },
      },
    ],
  });
});

// txd main.js

//分页
$(function () {
  var pagination = $("#pagination");
  if (pagination.length === 0) return;

  var pageData = pagination.data(),
    pageTotal = pageData.total,
    pageUrl = pageData.strurl,
    pagePsize = pageData.psize,
    pageCurrent = pageData.current - 1;

  var initPagination = (function () {
    // 创建分页
    pagination.pagination(pageTotal, {
      current_page: pageCurrent, //当前选中的页面
      link_to: pageUrl,
      num_edge_entries: 1, //边缘页数
      num_display_entries: 4, //主体页数
      prev_text: " ",
      next_text: " ",
      // str_pad_left: true,
      items_per_page: pagePsize, //每页显示1项
      callback: function (page_id, panel) {},
    });
  })();
});

$(".gotop").click(function () {
  $("html,body").animate(
    {
      scrollTop: 0,
    },
    300
  );
});

// historical Evolution
$(function () {
  if (!$.fn.slick) return;
  var sliderFor = $(".slick-history-left");
  var sliderNav = $(".slick-history-right");
  sliderFor.slick({
    autoplay: true,
    autoplaySpeed: 3000,
    slidesToShow: 8,
    slidesToScroll: 1,
    arrows: true,
    fade: false,
    infinite: true,
    centerMode: false,
    touchThreshold: 300,
    adaptiveHeight: true,
    asNavFor: ".slick-history-right",
    vertical: true,
    pauseOnHover: true,
  });
  sliderNav.slick({
    autoplay: true,
    autoplaySpeed: 3000,
    slidesToShow: 8,
    slidesToScroll: 1,
    infinite: true,
    centerMode: false,
    centerPadding: "0px",
    asNavFor: ".slick-history-left",
    dots: false,
    arrows: false,
    touchThreshold: 300,
    focusOnSelect: true,
    adaptiveHeight: true,
    vertical: true,
    pauseOnHover: true,
  });

  if (
    sliderNav.slick("slickGetOption", "slidesToShow") >=
    sliderNav.find(".slick-slide").length
  ) {
    sliderNav.slick("slickSetOption", "centerMode", false);
    sliderNav.find(".slick-track").addClass("transform-0");
  }
});

// 证书

$(function () {
  if (!$.fn.slick) return;
  var certificate = $(".slick-certificate");
  certificate.slick({
    autoplay: true,
    autoplaySpeed: 3000,
    arrows: true,
    fade: false,
    dots: false,
    speed: 800,
    cssEase: "ease",
    slidesToShow: 5,
    slidesToScroll: 1,
    focusOnSelect: false,
    touchThreshold: 10,
    infinite: true,
    swipeToSlide: true,
    lazyLoad: "anticipated",
    variableWidth: false,
    adaptiveHeight: false,
    rows: 1,
    slidesPerRow: 1,
    pauseOnHover: true,
    responsive: [
      {
        breakpoint: 1200,
        settings: {
          slidesToShow: 4,
          slidesToScroll: 1,
        },
      },
      {
        breakpoint: 992,
        settings: {
          slidesToShow: 3,
          slidesToScroll: 1,
        },
      },
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1,
        },
      },
    ],
  });
});

// meet Our Team
$(function () {
  if (!$.fn.slick) return;
  var team = $(".slick-team");
  team.slick({
    autoplay: true,
    autoplaySpeed: 3000,
    arrows: false,
    fade: false,
    dots: false,
    speed: 800,
    cssEase: "ease",
    slidesToShow: 4,
    slidesToScroll: 1,
    focusOnSelect: false,
    touchThreshold: 10,
    infinite: true,
    swipeToSlide: true,
    lazyLoad: "anticipated",
    variableWidth: false,
    adaptiveHeight: false,
    rows: 1,
    slidesPerRow: 1,
    pauseOnHover: true,
    responsive: [
      {
        breakpoint: 1200,
        settings: {
          slidesToShow: 4,
          slidesToScroll: 1,
        },
      },
      {
        breakpoint: 992,
        settings: {
          slidesToShow: 3,
          slidesToScroll: 1,
        },
      },
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1,
        },
      },
    ],
  });
});

// 产品详情table加减数量按

$(function () {
  var child = $(".checkbox-child"),
    len = child.length,
    checkAll = true,
    allBtn = $("#all");

  child.each(function () {
    if (!$(this).is(":checked")) {
      checkAll = false;
    }
  });
  allBtn.trigger("change");

  child.on("change", ":checkbox", function () {
    var a = false;

    if ($(this).parent().hasClass("change")) {
      $(this).attr("checked", false).parent().removeClass("change");
    } else {
      $(this).attr("checked", true).parent().addClass("change");
    }
    for (var i = 0; i < len; i++) {
      if (child.eq(i).hasClass("change")) {
        a = true;
      } else {
        a = false;
        break;
      }
    }
    if (a) {
      allBtn.attr("checked", true).parent().addClass("change");
    } else {
      allBtn.attr("checked", false).parent().removeClass("change");
    }
  });

  allBtn.on("change", function () {
    if ($(this).is(":checked")) {
      $(".substitite")
        .addClass("change")
        .children("input")
        .attr("checked", true);
    } else {
      $(".substitite")
        .removeClass("change")
        .children("input")
        .attr("checked", false);
    }
  });

  allBtn.trigger("click");
});



$(".cart-btn").click(function(){
    var id = $(this).data('id');
    $.cart.add(id);
});

$(".J-shoping-close").click(function(){
    var id = $(this).data('id');
    $.cart.del(id);
});

$(function() {
    var iptNum = 0;
    $(".add1").on("click", function() {
        iptNum = parseInt($(this).siblings(".ipt-num").val());
        $(this).siblings(".ipt-num").val(iptNum + 1).trigger('input');
    })
    $(".del1").on("click", function() {
        iptNum = parseInt($(this).siblings(".ipt-num").val());
        iptNum--;
        if(iptNum < 1) {
            iptNum = 1;
        }
        $(this).siblings(".ipt-num").val(iptNum).trigger('input');
    })
});
