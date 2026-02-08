/**
 *
 */

$(function () {
  let $container = $(".auto-adjust-img");
  if ($container.length === 0) {
    return;
  }

  if (
    /mobile/i.test(window.navigator.userAgent) &&
    window.screen.availWidth < 768
  ) {
    $container.addClass("is-mobile");
    return;
  }

  $("p", $container).each(function (index, p) {
    let $p = $(this);
    let $imgs = $p.children("img");
    if ($imgs.length >= 2 && $imgs.length === $p.children().length) {
      $p.addClass("contains-pictures");
    }
  });

  $(".contains-pictures", $container).each(function (index, p) {
    let $box = $(p);
    let tasks = [];

    $("img", $box).each(function (index, img) {
      let $img = $(img);
      $img.removeAttr("width").removeAttr("height").removeAttr("style");
      $img.addClass("loaded").removeClass("resized");

      let task = new Promise((resolve, reject) => {
        imgReady(
          $img.attr("src"),
          function () {
            resolve({
              el: img,
              w: this.width,
              h: this.height,
              m: $img.outerWidth(true) - $img.outerWidth(false),
            });
          },
          () => reject()
        );
      });

      tasks.push(task);
    });

    Promise.all(tasks).then((images) => {
      const maxHeightImg = _.maxBy(images, function (o) {
        return o.h;
      });

      $(window)
        .on(
          "resize",
          _.throttle(function () {
            // 父元素容器最大内部宽度 (不含图片边距、边框)
            let boxInnerWidth = parseInt($box.innerWidth());
            boxInnerWidth -= _.reduce(
              images,
              function (sum, o, key) {
                return sum + o.m;
              },
              0
            );

            // 按照最大高度图片放大所有图片，计算放大后最大宽度之和
            let boxInnerWidthImg = Math.floor(
              _.reduce(
                images,
                function (sum, o, key) {
                  return sum + o.w * (maxHeightImg.h / o.h);
                },
                0
              )
            );

            // 等比缩放到不超过最大宽度
            let maxImgHeight = maxHeightImg.h;
            if (boxInnerWidthImg !== boxInnerWidth) {
              maxImgHeight = maxImgHeight * (boxInnerWidth / boxInnerWidthImg);
            }

            $.each(images, function (index, img) {
              $(img.el)
                .addClass("resized")
                .attr("style", `height: ${maxImgHeight}px !important`);
            });
          }, 100)
        )
        .trigger("resize");
    });
  });
});
