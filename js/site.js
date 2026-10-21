// Front-end behaviour: header and full-screen menu, dropdown folders, the
// custom cursor, scroll progress line, lightbox, product gallery and scroll
// reveals.

(() => {
  const root = document.documentElement;

  // Headers sit below the admin's draft banner, which can wrap on narrow screens.
  const draftBar = document.querySelector('.draft-bar');
  if (draftBar) new ResizeObserver(() => root.style.setProperty('--draft-bar-h', `${draftBar.offsetHeight}px`)).observe(draftBar);

  const header = document.querySelector('[data-header]');

  // ---- Full-screen menu (tablet and phone) --------------------------------------
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.getElementById('mobile-menu');

  const showPanel = (name) => {
    menu.querySelectorAll('.mobile-panel').forEach((panel) => {
      const active = panel.dataset.panel === name;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });
    menu.querySelector('.mobile-panel.is-active a, .mobile-panel.is-active button')?.focus({ preventScroll: true });
  };

  const setMenu = (open) => {
    if (!menu || open === (toggle.getAttribute('aria-expanded') === 'true')) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.sr-only').textContent = open ? 'Close menu' : 'Menu';
    root.classList.toggle('menu-open', open);
    if (open) {
      menu.hidden = false;
      showPanel('root');
      requestAnimationFrame(() => menu.classList.add('is-open'));
    } else {
      menu.classList.remove('is-open');
      setTimeout(() => {
        if (toggle.getAttribute('aria-expanded') === 'false') menu.hidden = true;
      }, 350);
    }
  };

  if (toggle && menu) {
    toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (event) => {
      const opener = event.target.closest('[data-open-panel]');
      if (opener) return showPanel(opener.dataset.openPanel);
      if (event.target.closest('[data-close-panel]')) return showPanel('root');
      if (event.target.closest('a')) setMenu(false);
    });
    matchMedia('(min-width: 992px)').addEventListener('change', (e) => e.matches && setMenu(false));
  }

  // ---- Desktop dropdown folders --------------------------------------------------------
  // CSS opens a folder on mouse hover and keyboard focus. A click (touch
  // screens, keyboard Enter) pins it with .is-open, and leaving with the mouse
  // always unpins it, so a list is never left hanging open.
  const closeFolder = (folder) => {
    folder.classList.remove('is-open');
    folder.firstElementChild.setAttribute('aria-expanded', 'false');
  };
  const closeFolders = (except) => {
    document.querySelectorAll('.nav-folder.is-open').forEach((folder) => folder !== except && closeFolder(folder));
  };

  document.querySelectorAll('.nav-folder > button').forEach((button) => {
    const folder = button.parentElement;
    button.addEventListener('click', () => {
      const open = !folder.classList.contains('is-open');
      closeFolders(folder);
      folder.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', String(open));
    });
    folder.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') button.setAttribute('aria-expanded', 'true');
    });
    folder.addEventListener('pointerleave', (event) => {
      if (event.pointerType !== 'mouse') return;
      closeFolder(folder);
      // Drop focus from the folder title so a mouse click doesn't keep it styled as open.
      if (folder.contains(document.activeElement) && !document.activeElement.matches(':focus-visible')) document.activeElement.blur();
    });
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.nav-folder')) closeFolders();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeFolders();
    if (toggle?.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      toggle.focus();
    }
  });

  // ---- Header backing once the page scrolls (CSS decides when it is pinned) -------------
  if (header) {
    const hero = document.querySelector('.hero, .project-hero--fullscreen');
    const update = () => {
      const limit = hero && header.classList.contains('site-header--overlay') ? hero.offsetHeight - header.offsetHeight : 10;
      header.classList.toggle('is-scrolled', window.scrollY > limit);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
  }
  window.addEventListener('hashchange', () => setMenu(false));

  // ---- Scroll progress line (Theme decides whether it shows) ------------------------------
  const progress = document.querySelector('.scroll-progress');
  if (progress) {
    const updateProgress = () => {
      const max = root.scrollHeight - innerHeight;
      progress.style.setProperty('--progress', max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress, { passive: true });
  }

  // ---- Custom cursor -------------------------------------------------------------------
  // "Two dots": a dark dot and a light dot follow the pointer with different
  // easing. Over links the light dot swells into a tinted disc; over projects
  // and images the dark dot grows into a frosted bubble with a label.
  // "Single dot" (data-cursor-style="single"): one dot sits right on the
  // pointer and CSS restyles the same states; it also learns when the
  // background under it is dark so it can turn light.
  const cursor = document.querySelector('.cursor');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 992px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  if (cursor && !reducedMotion.matches) {
    const ring = cursor.querySelector('.cursor-ring');
    const dot = cursor.querySelector('.cursor-dot');
    const text = cursor.querySelector('.cursor-text');
    const target = { x: innerWidth / 2, y: innerHeight / 2 };
    const ringPos = { ...target };
    const dotPos = { ...target };
    let running = false;

    const frame = () => {
      const ringEase = root.dataset.cursorStyle === 'single' ? 1 : 0.2;
      ringPos.x += (target.x - ringPos.x) * ringEase;
      ringPos.y += (target.y - ringPos.y) * ringEase;
      dotPos.x += (target.x - dotPos.x) * 0.1;
      dotPos.y += (target.y - dotPos.y) * 0.1;
      ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
      dot.style.transform = `translate3d(${dotPos.x}px, ${dotPos.y}px, 0)`;
      const settled = Math.abs(target.x - dotPos.x) + Math.abs(target.y - dotPos.y) < 0.1;
      running = !settled;
      if (running) requestAnimationFrame(frame);
    };

    // Is the first painted background behind this element dark?
    const onDark = (el) => {
      for (let node = el; node?.nodeType === 1; node = node.parentElement) {
        const value = getComputedStyle(node).backgroundColor;
        const rgb = value.match(/^rgba?\(([^)]+)\)/);
        const srgb = value.match(/^color\(srgb ([^)]+)\)/);
        if (!rgb && !srgb) continue;
        const parts = (rgb ?? srgb)[1].split(/[\s,/]+/).filter(Boolean).map(Number);
        if ((parts[3] ?? 1) < 0.5) continue;
        const [r, g, b] = srgb ? parts.map((p) => p * 255) : parts;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b < 70;
      }
      return false;
    };

    const setState = (el) => {
      cursor.classList.toggle('on-dark', onDark(el));
      const media = el?.closest('[data-cursor]');
      const link = el?.closest('a, button, input, select, textarea, label, summary, [role="button"]');
      cursor.classList.toggle('is-open', Boolean(media));
      cursor.classList.toggle('is-link', !media && Boolean(link));
      if (media) {
        text.textContent = media.dataset.cursor === 'image' ? cursor.dataset.labelImage : cursor.dataset.label;
      }
    };

    document.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse' || !finePointer.matches) return;
      if (!root.classList.contains('cursor-ready')) {
        // Start both dots at the pointer instead of sliding in from the centre.
        Object.assign(ringPos, { x: event.clientX, y: event.clientY });
        Object.assign(dotPos, ringPos);
        root.classList.add('cursor-ready');
      }
      target.x = event.clientX;
      target.y = event.clientY;
      cursor.classList.remove('is-away');
      if (!running) {
        running = true;
        requestAnimationFrame(frame);
      }
    }, { passive: true });

    document.addEventListener('pointerover', (event) => setState(event.target));
    document.documentElement.addEventListener('mouseleave', () => cursor.classList.add('is-away'));
    finePointer.addEventListener('change', (e) => !e.matches && root.classList.remove('cursor-ready'));
  }

  // ---- Lightbox -------------------------------------------------------------------------
  const galleries = document.querySelectorAll('[data-lightbox]');
  if (galleries.length) {
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.hidden = true;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Image viewer');
    box.innerHTML = `
      <button class="lightbox-prev" type="button" aria-label="Previous image">‹</button>
      <figure><img alt=""></figure>
      <button class="lightbox-next" type="button" aria-label="Next image">›</button>
      <button class="lightbox-close" type="button" aria-label="Close">×</button>`;
    document.body.append(box);
    const img = box.querySelector('img');
    let links = [];
    let index = 0;
    let lastFocus = null;

    const show = (i) => {
      index = (i + links.length) % links.length;
      const link = links[index];
      img.src = link.dataset.full;
      img.alt = link.querySelector('img')?.alt || '';
      const id = link.closest('.gallery-item')?.id.replace('item-', '');
      history.replaceState(null, '', id ? `?item=${id}` : location.pathname);
    };
    const open = (gallery, i) => {
      links = [...gallery.querySelectorAll('a[data-full]')];
      lastFocus = document.activeElement;
      box.hidden = false;
      root.style.overflow = 'hidden';
      show(i);
      box.querySelector('.lightbox-close').focus();
    };
    const close = () => {
      box.hidden = true;
      root.style.overflow = '';
      history.replaceState(null, '', location.pathname);
      lastFocus?.focus();
    };

    galleries.forEach((gallery) => {
      gallery.addEventListener('click', (event) => {
        const link = event.target.closest('a[data-full]');
        if (!link) return;
        event.preventDefault();
        open(gallery, [...gallery.querySelectorAll('a[data-full]')].indexOf(link));
      });
    });
    box.querySelector('.lightbox-prev').addEventListener('click', () => show(index - 1));
    box.querySelector('.lightbox-next').addEventListener('click', () => show(index + 1));
    box.querySelector('.lightbox-close').addEventListener('click', close);
    box.addEventListener('click', (event) => {
      if (event.target === box || event.target.tagName === 'FIGURE') close();
    });
    document.addEventListener('keydown', (event) => {
      if (box.hidden) return;
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowLeft') show(index - 1);
      if (event.key === 'ArrowRight') show(index + 1);
    });

    // Swipe between images on touch screens.
    let touchX = null;
    box.addEventListener('touchstart', (e) => (touchX = e.touches[0].clientX), { passive: true });
    box.addEventListener('touchend', (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
      touchX = null;
    });

    // Deep link: ?item=<id> opens that image directly.
    const deepLink = new URLSearchParams(location.search).get('item');
    const target = deepLink && document.getElementById(`item-${deepLink}`);
    if (target) {
      const gallery = target.closest('[data-lightbox]');
      open(gallery, [...gallery.querySelectorAll('.gallery-item')].indexOf(target));
    }
  }

  // ---- Project slideshows ------------------------------------------------------------------
  document.querySelectorAll('[data-slideshow]').forEach((show) => {
    const slides = [...show.querySelectorAll('.slide')];
    const dots = [...show.querySelectorAll('.slide-dots button')];
    if (slides.length < 2) return;
    let index = 0;
    const go = (i) => {
      index = (i + slides.length) % slides.length;
      slides.forEach((slide, n) => {
        slide.classList.toggle('is-active', n === index);
        slide.setAttribute('aria-hidden', String(n !== index));
      });
      dots.forEach((dot, n) => dot.setAttribute('aria-current', String(n === index)));
    };
    show.querySelector('.slide-prev').addEventListener('click', () => go(index - 1));
    show.querySelector('.slide-next').addEventListener('click', () => go(index + 1));
    dots.forEach((dot, n) => dot.addEventListener('click', () => go(n)));
    show.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') go(index - 1);
      if (event.key === 'ArrowRight') go(index + 1);
    });
    let touchX = null;
    show.addEventListener('touchstart', (e) => (touchX = e.touches[0].clientX), { passive: true });
    show.addEventListener('touchend', (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
      touchX = null;
    });
  });

  // ---- Product image switcher ------------------------------------------------------------
  document.querySelectorAll('[data-product-gallery]').forEach((gallery) => {
    const main = gallery.querySelector('.product-main img');
    gallery.querySelectorAll('.product-thumbs button').forEach((button) => {
      button.addEventListener('click', () => {
        main.src = button.dataset.src;
        gallery.querySelectorAll('.product-thumbs button').forEach((b) => b.setAttribute('aria-current', String(b === button)));
      });
    });
  });

  // ---- Scroll reveal ----------------------------------------------------------------------
  const reveals = document.querySelectorAll('.reveal');
  if (root.classList.contains('has-motion') && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px' }
    );
    reveals.forEach((el) => observer.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-visible'));
  }
})();
