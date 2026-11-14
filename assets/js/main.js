/**
 * Koteshu Indonesia — interaksi halaman utama
 * File: assets/js/main.js
 */

(function () {
    "use strict";

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ------------------------------------------------------------------
       1. Navbar: bayangan saat digulir + toggle menu mobile
    ------------------------------------------------------------------ */
    const nav = document.getElementById("nav");
    const navToggle = document.getElementById("navToggle");
    const navLinks = document.getElementById("navLinks");

    if (nav) {
        const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 12);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
    }

    if (navToggle && navLinks) {
        const setOpen = (open) => {
            navLinks.classList.toggle("is-open", open);
            navToggle.setAttribute("aria-expanded", String(open));
            navToggle.setAttribute("aria-label", open ? "Tutup menu navigasi" : "Buka menu navigasi");
        };

        navToggle.addEventListener("click", () => {
            setOpen(navToggle.getAttribute("aria-expanded") !== "true");
        });

        // Tutup menu setelah memilih tautan
        navLinks.addEventListener("click", (event) => {
            if (event.target.closest("a")) setOpen(false);
        });

        // Tutup dengan tombol Escape
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && navToggle.getAttribute("aria-expanded") === "true") {
                setOpen(false);
                navToggle.focus();
            }
        });

        // Tutup saat klik di luar menu
        document.addEventListener("click", (event) => {
            if (!navLinks.contains(event.target) && !navToggle.contains(event.target)) {
                setOpen(false);
            }
        });
    }

    /* ------------------------------------------------------------------
       2. Animasi muncul saat elemen masuk viewport
    ------------------------------------------------------------------ */
    const revealItems = document.querySelectorAll(".reveal");

    if (!("IntersectionObserver" in window) || reduceMotion) {
        revealItems.forEach((item) => item.classList.add("is-visible"));
    } else {
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;

                const siblings = Array.from(entry.target.parentElement.children).filter((el) =>
                    el.classList.contains("reveal")
                );
                const index = Math.max(0, siblings.indexOf(entry.target));

                entry.target.style.transitionDelay = Math.min(index * 80, 320) + "ms";
                entry.target.classList.add("is-visible");
                revealObserver.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

        revealItems.forEach((item) => revealObserver.observe(item));
    }

    /* ------------------------------------------------------------------
       3. Filter kategori menu
    ------------------------------------------------------------------ */
    const chips = document.querySelectorAll(".chip");
    const menuCards = document.querySelectorAll("#menuGrid .menu-card");

    chips.forEach((chip) => {
        chip.addEventListener("click", () => {
            const filter = chip.dataset.filter;

            chips.forEach((other) => other.setAttribute("aria-pressed", String(other === chip)));

            menuCards.forEach((card) => {
                const cocok = filter === "semua" || card.dataset.kategori === filter;
                card.hidden = !cocok;
            });

            // Kalau filter dipakai setelah kartu ter-reveal, pastikan tetap tampil
            if (!reduceMotion) {
                menuCards.forEach((card) => card.classList.add("is-visible"));
            }
        });
    });

    /* ------------------------------------------------------------------
       4. Sorot jam buka hari ini (0 = Minggu, 1 = Senin, ...)
    ------------------------------------------------------------------ */
    const hoursList = document.getElementById("hoursList");
    if (hoursList) {
        const day = new Date().getDay(); // 0–6
        let selector = null;

        if (day >= 1 && day <= 4) selector = '[data-day="1"]';
        else if (day === 5 || day === 6) selector = '[data-day="5"]';
        else selector = '[data-day="0"]';

        const row = hoursList.querySelector(selector);
        if (row) {
            row.classList.add("today");
            row.insertAdjacentHTML("beforeend", '<span class="visually-hidden"> (buka hari ini)</span>');
        }
    }

    /* ------------------------------------------------------------------
       5. Tahun berjalan di footer
    ------------------------------------------------------------------ */
    const year = document.getElementById("year");
    if (year) year.textContent = String(new Date().getFullYear());
})();
