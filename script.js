// Videos: only the ones near the screen load and play; everything else stays
// paused, so the device never decodes more than a couple of videos at a time
const videos = document.querySelectorAll("video:not(.player__video)");
const onScreen = new Set();
let videosOnHold = false; // true while the pop-up player has the screen
const play = (v) => {
  if (videosOnHold) return;
  v.muted = true;
  v.play().catch(() => {});
};

if (videos.length) {
  const videoObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (isIntersecting) {
          onScreen.add(target);
          if (!document.hidden) play(target);
        } else {
          onScreen.delete(target);
          target.pause();
        }
      });
    },
    { rootMargin: "200px 0px" }
  );
  videos.forEach((v) => videoObserver.observe(v));

  // pause everything in a background tab, resume what's on screen when back
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) videos.forEach((v) => v.pause());
    else onScreen.forEach(play);
  });
  // some browsers block autoplay until the first tap
  window.addEventListener("pointerdown", () => onScreen.forEach(play), { once: true });
}

// Our Work pop-up: a tile opens its film with sound. One <video> serves every tile
// and the background videos pause while it plays, so only one video is decoding
const player = document.querySelector(".player");
if (player) {
  const film = player.querySelector(".player__video");
  const stage = player.querySelector(".player__stage");
  const title = player.querySelector(".player__title");
  const root = document.documentElement;
  const net = navigator.connection;

  // 1080p on big screens, 720p on phones, 480p on data saver and slow connections.
  // A film that stalls steps down a size, and stays down for the rest of the visit
  const sizes = ["1080", "720", "480"];
  let lowest = 0;
  const pickSize = () => {
    const phone = Math.max(screen.width, screen.height) < 1100 || navigator.deviceMemory <= 2;
    const slow = net && (net.saveData || /2g|3g/.test(net.effectiveType));
    return sizes[Math.max(slow ? 2 : phone ? 1 : 0, lowest)];
  };

  // the tile plays Assets/Videos/web/X.mp4, its film is Assets/Videos/play/1080/X.mp4
  const load = (btn) => {
    const tile = btn.parentElement.querySelector("video");
    const src = tile.getAttribute("src").replace("/web/", `/play/${pickSize()}/`);
    if (film.getAttribute("src") === src) return;
    film.poster = tile.poster;
    film.src = src;
  };

  const start = () => {
    film.play().catch((err) => {
      // sound refused by the browser: play muted, the controls can unmute
      if (err.name !== "NotAllowedError") return;
      film.muted = true;
      film.play().catch(() => {});
    });
  };

  let stallTimer;
  let resumeAt = 0;
  const stepDown = () => {
    const src = film.getAttribute("src");
    const size = sizes.findIndex((s) => src.includes(`/play/${s}/`));
    lowest = size + 1;
    resumeAt = film.currentTime;
    film.src = src.replace(`/play/${sizes[size]}/`, `/play/${sizes[lowest]}/`);
    start();
  };
  const buffering = () => {
    stage.classList.add("is-loading");
    clearTimeout(stallTimer);
    if (film.getAttribute("src").includes(`/play/${sizes[sizes.length - 1]}/`)) return;
    // the first frame gets more patience than a stall in the middle of the film
    stallTimer = setTimeout(stepDown, film.currentTime > 0 ? 1000 : 2500);
  };
  const buffered = () => {
    stage.classList.remove("is-loading");
    clearTimeout(stallTimer);
  };
  film.addEventListener("loadedmetadata", () => {
    if (resumeAt) film.currentTime = resumeAt;
    resumeAt = 0;
  });
  film.addEventListener("waiting", buffering);
  ["playing", "pause", "error"].forEach((type) => film.addEventListener(type, buffered));

  const open = (btn) => {
    load(btn);
    if (!player.showModal) return window.open(film.src); // browsers older than <dialog>
    stage.style.setProperty("--ratio", btn.dataset.ratio);
    title.textContent = btn.parentElement.querySelector(".board__heading").textContent;
    root.style.setProperty("--scrollbar", `${window.innerWidth - root.clientWidth}px`);
    videosOnHold = true;
    videos.forEach((v) => v.pause());
    player.showModal();
    // has to stay inside the click, or browsers block the sound
    film.muted = false;
    start();
    buffering();
  };

  document.querySelectorAll(".board__play").forEach((btn) => {
    // with a mouse the hover buffers the film, so the click starts it right away
    let hoverTimer;
    btn.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse" && !(net && net.saveData)) hoverTimer = setTimeout(() => load(btn), 150);
    });
    btn.addEventListener("pointerleave", () => clearTimeout(hoverTimer));
    btn.addEventListener("click", () => {
      clearTimeout(hoverTimer);
      open(btn);
    });
  });

  player.querySelector(".player__close").addEventListener("click", () => player.close());
  // clicks beside the video land on the dialog itself
  player.addEventListener("click", (e) => {
    if (e.target === player) player.close();
  });
  // every way out ends here: the close button, a click beside the video, Esc, Android back
  player.addEventListener("close", () => {
    buffered();
    resumeAt = 0;
    film.pause();
    film.removeAttribute("src");
    film.load(); // stops the download and frees the decoder
    videosOnHold = false;
    if (!document.hidden) onScreen.forEach(play);
  });
}

// Scroll-reveal for the tilted service cards
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

document.querySelectorAll(".service-card").forEach((card) => observer.observe(card));

// Hand-drawn arrows scroll the "details" cards one card at a time
const detailsTrack = document.querySelector(".details__track");
if (detailsTrack) {
  const prevBtn = document.querySelector(".details__arrow--prev");
  const nextBtn = document.querySelector(".details__arrow--next");

  const step = () => {
    const card = detailsTrack.querySelector(".detail-card");
    const gap = parseFloat(getComputedStyle(detailsTrack).columnGap) || 0;
    return card ? card.offsetWidth + gap : detailsTrack.clientWidth;
  };

  const updateArrows = () => {
    const max = detailsTrack.scrollWidth - detailsTrack.clientWidth - 2;
    prevBtn.disabled = detailsTrack.scrollLeft <= 2;
    nextBtn.disabled = detailsTrack.scrollLeft >= max;
  };

  prevBtn.addEventListener("click", () => detailsTrack.scrollBy({ left: -step(), behavior: "smooth" }));
  nextBtn.addEventListener("click", () => detailsTrack.scrollBy({ left: step(), behavior: "smooth" }));
  detailsTrack.addEventListener("scroll", updateArrows, { passive: true });
  window.addEventListener("resize", updateArrows);
  updateArrows();
}

// Butterfly that follows the scroll: zig-zags side to side as the page goes down
const traveller = document.querySelector(".butterfly--1");
if (traveller && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.body.appendChild(traveller);
  traveller.classList.add("butterfly--travel");

  const SWINGS = 5; // half-crossings over the whole page
  const pos = { x: 0, y: 0, tilt: 0 };

  // page height is measured once (and on resize), not every frame
  let vw = 0, vh = 0, maxScroll = 1;
  const measure = () => {
    vw = window.innerWidth;
    vh = window.innerHeight;
    maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
  };
  measure();

  const target = () => {
    const p = Math.min(1, window.scrollY / maxScroll);
    const sideMargin = Math.min(0.14, 60 / vw);
    const x = vw * (sideMargin + (1 - 2 * sideMargin) * (0.5 - 0.5 * Math.cos(p * Math.PI * SWINGS)));
    const y = vh * (0.24 + 0.4 * Math.sin(p * Math.PI));
    return { x, y };
  };

  Object.assign(pos, target());

  // the frame loop only runs while the butterfly is still catching up
  let running = false;
  const tick = () => {
    const t = target();
    const dx = t.x - pos.x;
    const dy = t.y - pos.y;
    pos.x += dx * 0.08;
    pos.y += dy * 0.08;
    const tiltTarget = Math.max(-35, Math.min(35, dx * 0.6));
    pos.tilt += (tiltTarget - pos.tilt) * 0.1;
    traveller.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) rotate(${pos.tilt}deg)`;

    if (Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3 && Math.abs(tiltTarget - pos.tilt) < 0.3) {
      running = false;
      return;
    }
    requestAnimationFrame(tick);
  };
  const wake = () => {
    if (running) return;
    running = true;
    requestAnimationFrame(tick);
  };

  window.addEventListener("scroll", wake, { passive: true });
  window.addEventListener("resize", () => { measure(); wake(); });
  window.addEventListener("load", () => { measure(); wake(); });
  wake();
}

// "Make it unmissable" tile: cycle the slides with hard cuts (only while visible)
const shoutTile = document.querySelector(".board__tile--shout");
const shoutSlides = shoutTile ? shoutTile.querySelectorAll(".shout") : [];
if (shoutSlides.length > 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  let current = 0;
  let timer = null;
  const next = () => {
    shoutSlides[current].classList.remove("is-active");
    current = (current + 1) % shoutSlides.length;
    shoutSlides[current].classList.add("is-active");
  };
  new IntersectionObserver(([entry]) => {
    clearInterval(timer);
    timer = entry.isIntersecting ? setInterval(next, 1800) : null;
  }).observe(shoutTile);
}

// Project brief form: send to hola@twopotatoes.io via FormSubmit without leaving the page
const brief = document.querySelector(".brief");
if (brief) {
  const status = brief.querySelector(".brief__status");
  const submit = brief.querySelector(".brief__submit");

  const honey = brief.querySelector(".brief__honey");
  const loadedAt = Date.now();
  let lastSent = 0;

  brief.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.className = "brief__status";

    // bots fill the hidden field or submit instantly: pretend it worked, send nothing
    if (honey.value || Date.now() - loadedAt < 3000) {
      brief.reset();
      status.classList.add("is-ok");
      status.textContent = "Thanks! We got your brief and will be in touch soon.";
      return;
    }
    // one enquiry per minute from the same visitor
    if (Date.now() - lastSent < 60000) {
      status.classList.add("is-error");
      status.textContent = "Already sent! Please wait a minute before sending again.";
      return;
    }

    status.textContent = "Sending...";
    submit.disabled = true;

    try {
      const res = await fetch("https://formsubmit.co/ajax/hola@twopotatoes.io", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(brief),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || String(data.success) === "false") throw new Error(data.message || "Failed");

      lastSent = Date.now();
      brief.reset();
      status.classList.add("is-ok");
      status.textContent = "Thanks! We got your brief and will be in touch soon.";
    } catch (err) {
      status.classList.add("is-error");
      status.textContent = "Something went wrong. Please email us at hola@twopotatoes.io";
    } finally {
      submit.disabled = false;
    }
  });
}
