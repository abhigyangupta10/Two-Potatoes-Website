// Videos: only the ones near the screen load and play; everything else stays
// paused, so the device never decodes more than a couple of videos at a time
const videos = document.querySelectorAll("video");
if (videos.length) {
  const onScreen = new Set();
  const play = (v) => {
    v.muted = true;
    v.play().catch(() => {});
  };

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
