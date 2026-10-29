
const graphicVideos = document.querySelectorAll(".graphic-video");

let currentGraphicVideo = 0;

function playGraphicVideo(index) {
    graphicVideos.forEach((video) => {
        video.pause();
        video.classList.remove("active");
        video.currentTime = 0;
    });

    const nextVideo = graphicVideos[index];

    nextVideo.classList.add("active");
    nextVideo.load();

    nextVideo.play().catch((error) => {
        console.log("Video playback issue:", error);
    });
}

graphicVideos.forEach((video, index) => {
    video.addEventListener("ended", () => {
        currentGraphicVideo = (index + 1) % graphicVideos.length;
        playGraphicVideo(currentGraphicVideo);
    });

    video.addEventListener("error", () => {
        console.log("Could not load video:", video.querySelector("source").src);
    });
});
