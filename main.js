/*jshint esversion:6*/

$(function () {
    const { InferenceEngine, CVImage } = inferencejs;
    const inferEngine = new InferenceEngine();

    const video = $("video")[0];

    var workerId;
    var cameraMode = "environment";

    const startVideoStreamPromise = navigator.mediaDevices
        .getUserMedia({
            audio: false,
            video: {
                facingMode: cameraMode
            }
        })
        .then(function (stream) {
            return new Promise(function (resolve) {
                video.srcObject = stream;
                video.onloadeddata = function () {
                    video.play();
                    resolve();
                };
            });
        });

    const loadModelPromise = new Promise(function (resolve, reject) {
        inferEngine
            .startWorker("ppe-kv3ng", "15", "rf_4xONXi3ndFSqsmdzaoFQ9ra7SyY2")
            .then(function (id) {
                workerId = id;
                resolve();
            })
            .catch(reject);
    });

    Promise.all([startVideoStreamPromise, loadModelPromise]).then(function () {
        $("body").removeClass("filter");
        $("div.loader").hide();
        resizeCanvas();
        detectFrame();
    });


    var canvas, ctx;
    const font = "16px sans-serif";

    function videoDimensions(video) {
        var videoRatio = video.videoWidth / video.videoHeight;
        var width = video.offsetWidth,
            height = video.offsetHeight;
        var elementRatio = width / height;

        if (elementRatio > videoRatio) {
            width = height * videoRatio;
        } else {
            height = width / videoRatio;
        }

        return {
            width: width,
            height: height
        };
    }

    $(window).resize(function () {
        resizeCanvas();
    });

    const resizeCanvas = function () {
        $("canvas").remove();

        canvas = $("<canvas/>");

        ctx = canvas[0].getContext("2d");

        var dimensions = videoDimensions(video);

        console.log(
            video.videoWidth,
            video.videoHeight,
            video.offsetWidth,
            video.offsetHeight,
            dimensions
        );

        canvas[0].width = video.videoWidth;
        canvas[0].height = video.videoHeight;

        canvas.css({
            width: dimensions.width,
            height: dimensions.height,
            left: ($(window).width() - dimensions.width) / 2,
            top: ($(window).height() - dimensions.height) / 2
        });

        $("body").append(canvas);
    };

    const renderPredictions = function (predictions) {
        var scale = 1;
        let detectedLabels = [];

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        predictions.forEach(function (prediction) {
            const x = prediction.bbox.x;
            const y = prediction.bbox.y;

            const width = prediction.bbox.width;
            const height = prediction.bbox.height;

            if (["no_boots", "no_glasses", "no_gloves", "no_helmet", "no_mask", "no_vest"].includes(prediction.class)) {
                detectedLabels.push(prediction.class);
            }

            ctx.strokeStyle = prediction.color;
            ctx.lineWidth = 4;
            ctx.strokeRect(
                (x - width / 2) / scale,
                (y - height / 2) / scale,
                width / scale,
                height / scale
            );

            ctx.fillStyle = prediction.color;
            const textWidth = ctx.measureText(prediction.class).width;
            const textHeight = parseInt(font, 10); // base 10
            ctx.fillRect(
                (x - width / 2) / scale,
                (y - height / 2) / scale,
                textWidth + 8,
                textHeight + 4
            );
        });

        predictions.forEach(function (prediction) {
            const x = prediction.bbox.x;
            const y = prediction.bbox.y;

            const width = prediction.bbox.width;
            const height = prediction.bbox.height;

            ctx.font = font;
            ctx.textBaseline = "top";
            ctx.fillStyle = "#000000";
            ctx.fillText(
                prediction.class,
                (x - width / 2) / scale + 4,
                (y - height / 2) / scale + 1
            );
        });

        if (detectedLabels.length > 0) {
            $(".toast").addClass("detect");
            $(".toast .title p").text("Terdeteksi tidak melengkapi alat pelindung diri");
            $(".toast .title i").removeClass("ri-checkbox-circle-fill").addClass("ri-alert-fill");

            // Cek dan ganti teks sesuai dengan pelanggaran yang terdeteksi
            if (detectedLabels.includes("no_helmet")) {
                $(".label_helmet").text("❌ Helmet");
            } else {
                $(".label_helmet").text("✅ Helmet"); // Jika tidak ada "no_helmet", kembalikan ke ✅
            }

            if (detectedLabels.includes("no_glasses")) {
                $(".label_glasses").text("❌ Glasses");
            } else {
                $(".label_glasses").text("✅ Glasses"); // Jika tidak ada "no_glasses", kembalikan ke ✅
            }

            if (detectedLabels.includes("no_mask")) {
                $(".label_mask").text("❌ Mask");
            } else {
                $(".label_mask").text("✅ Mask"); // Jika tidak ada "no_mask", kembalikan ke ✅
            }

            if (detectedLabels.includes("no_vest")) {
                $(".label_vest").text("❌ Vest");
            } else {
                $(".label_vest").text("✅ Vest"); // Jika tidak ada "no_vest", kembalikan ke ✅
            }

            if (detectedLabels.includes("no_gloves")) {
                $(".label_gloves").text("❌ Gloves");
            } else {
                $(".label_gloves").text("✅ Gloves"); // Jika tidak ada "no_gloves", kembalikan ke ✅
            }

            if (detectedLabels.includes("no_boots")) {
                $(".label_boots").text("❌ Boots");
            } else {
                $(".label_boots").text("✅ Boots"); // Jika tidak ada "no_boots", kembalikan ke ✅
            }
        } else {
            $(".toast").removeClass("detect");
            $(".toast").addClass("normal");
            $(".toast .title p").text("Tidak Ada Pelanggaran");
            $(".toast .title i").removeClass("ri-alert-fill").addClass("ri-checkbox-circle-fill");

            // Kembalikan semua teks ke ✅ jika tidak ada pelanggaran
            $(".label_helmet").text("✅ Helmet");
            $(".label_glasses").text("✅ Glasses");
            $(".label_mask").text("✅ Mask");
            $(".label_vest").text("✅ Vest");
            $(".label_gloves").text("✅ Gloves");
            $(".label_boots").text("✅ Boots");
        }



        // $(".toast").on("click", ".close", function () {
        //     $(".toast").addClass("hidden");
        // });
    };

    var prevTime;
    var pastFrameTimes = [];
    const detectFrame = function () {
        if (!workerId) return requestAnimationFrame(detectFrame);

        const image = new CVImage(video);
        inferEngine
            .infer(workerId, image)
            .then(function (predictions) {
                requestAnimationFrame(detectFrame);
                renderPredictions(predictions);

                if (prevTime) {
                    pastFrameTimes.push(Date.now() - prevTime);
                    if (pastFrameTimes.length > 30) pastFrameTimes.shift();

                    var total = 0;
                    _.each(pastFrameTimes, function (t) {
                        total += t / 1000;
                    });
                }
                prevTime = Date.now();
            })
            .catch(function (e) {
                console.log("CAUGHT", e);
                requestAnimationFrame(detectFrame);
            });
    };
});
