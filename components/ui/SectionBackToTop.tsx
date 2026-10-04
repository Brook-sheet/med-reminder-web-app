'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp } from 'lucide-react';

interface Props {
  targetSelector?: string;
  targetHeading?: string;
  label: string;
  scrollToPageTop?: boolean;
}

type ScrollContainer = HTMLElement | Window;

interface Position {
  left: number;
  bottom: number;
}

function hasInternalScroll(element: HTMLElement): boolean {
  return (
    /auto|scroll/.test(getComputedStyle(element).overflowY) &&
    element.scrollHeight > element.clientHeight + 1
  );
}

function scrollContainerFor(target: HTMLElement): ScrollContainer {
  if (hasInternalScroll(target)) return target;

  let parent = target.parentElement;

  while (
    parent &&
    parent !== document.body &&
    parent !== document.documentElement
  ) {
    if (hasInternalScroll(parent)) return parent;
    parent = parent.parentElement;
  }

  return window;
}

function pageScrollContainers(target: HTMLElement): ScrollContainer[] {
  const containers: ScrollContainer[] = [window];

  if (target.scrollTop > 0 || hasInternalScroll(target)) {
    containers.push(target);
  }

  let parent = target.parentElement;

  while (
    parent &&
    parent !== document.body &&
    parent !== document.documentElement
  ) {
    if (parent.scrollTop > 0 || hasInternalScroll(parent)) {
      containers.push(parent);
    }

    parent = parent.parentElement;
  }

  return containers;
}

function pageScrollOffset(target: HTMLElement): number {
  return pageScrollContainers(target).reduce<number>(
    (total, container) =>
      total +
      (container instanceof HTMLElement
        ? container.scrollTop
        : window.scrollY),
    0,
  );
}

function visibleTop(): number {
  const topbar = document.querySelector<HTMLElement>('.rx-mobile-topbar');

  if (!topbar || getComputedStyle(topbar).display === 'none') {
    return 12;
  }

  return Math.max(12, topbar.getBoundingClientRect().bottom + 12);
}

export default function SectionBackToTop({
  targetSelector,
  targetHeading,
  label,
  scrollToPageTop = false,
}: Props) {
  const targetRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState<Position | null>(null);

  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;

    let frame = 0;

    const findTarget = () => {
      if (targetSelector) {
        return main.querySelector<HTMLElement>(targetSelector);
      }

      const heading = Array.from(main.querySelectorAll('h2')).find(
        (node) => node.textContent?.trim() === targetHeading,
      );

      return heading?.closest<HTMLElement>('section') ?? null;
    };

    const update = () => {
      cancelAnimationFrame(frame);

      frame = requestAnimationFrame(() => {
        const target = findTarget();
        targetRef.current = target;

        if (!target) {
          setPosition(null);
          return;
        }

        const rect = target.getBoundingClientRect();
        const viewport = window.visualViewport;
        const viewportHeight = viewport?.height ?? window.innerHeight;

        const viewportBottom =
          (viewport?.offsetTop ?? 0) + viewportHeight;

        const top = visibleTop();
        const container = scrollContainerFor(target);

        const progress = scrollToPageTop
          ? pageScrollOffset(target)
          : container === target
            ? target.scrollTop
            : top - rect.top;

        // Require a deeper scroll before showing the button.
        const revealAfter = Math.max(600, viewportHeight);

        const sectionOutsideView =
          rect.bottom <= top + 72 ||
          rect.top >= viewportBottom - 72;

        if (
          progress < revealAfter ||
          rect.width === 0 ||
          (!scrollToPageTop && sectionOutsideView)
        ) {
          setPosition(null);
          return;
        }

        const buttonBottom = scrollToPageTop
          ? viewportBottom - 104
          : Math.min(rect.bottom - 12, viewportBottom - 104);

        const next = {
          left: Math.max(
            64,
            Math.min(
              window.innerWidth - 64,
              rect.left + rect.width / 2,
            ),
          ),
          bottom: Math.max(12, window.innerHeight - buttonBottom),
        };

        setPosition((previous) =>
          previous &&
          previous.left === next.left &&
          previous.bottom === next.bottom
            ? previous
            : next,
        );
      });
    };

    update();

    document.addEventListener('scroll', update, true);
    window.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);

    const observer = new MutationObserver(update);
    observer.observe(main, {
      childList: true,
      subtree: true,
    });

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(main);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();

      document.removeEventListener('scroll', update, true);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [targetSelector, targetHeading, scrollToPageTop]);

  const backToTop = () => {
    const target = targetRef.current;
    if (!target) return;

    const behavior: ScrollBehavior = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
      ? 'auto'
      : 'smooth';

    if (scrollToPageTop) {
      // Reset the browser page and any nested scrolling containers.
      pageScrollContainers(target).forEach((container) => {
        container.scrollTo({
          top: 0,
          behavior,
        });
      });

      return;
    }

    const container = scrollContainerFor(target);

    if (container === target) {
      target.scrollTo({
        top: 0,
        behavior,
      });
    } else if (container instanceof HTMLElement) {
      const parentRect = container.getBoundingClientRect();

      const offset = Math.max(
        visibleTop(),
        parentRect.top + container.clientTop + 12,
      );

      container.scrollTo({
        top: Math.max(
          0,
          container.scrollTop +
            target.getBoundingClientRect().top -
            offset,
        ),
        behavior,
      });
    } else {
      window.scrollTo({
        top: Math.max(
          0,
          window.scrollY +
            target.getBoundingClientRect().top -
            visibleTop(),
        ),
        behavior,
      });
    }
  };

  if (!position) return null;

  return createPortal(
    <button
      type="button"
      onClick={backToTop}
      aria-label={label}
      title={label}
      style={{
        ...position,
        transform: 'translateX(-50%)',
      }}
      className="group fixed z-40 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/95 px-3.5 py-2 text-blue-700 shadow-sm backdrop-blur-sm transition-colors hover:border-blue-300 hover:bg-blue-100 active:bg-blue-200/70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500 print:hidden"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 transition-colors group-hover:bg-blue-200/70">
        <ChevronUp
          aria-hidden="true"
          className="h-4 w-4"
          strokeWidth={2.5}
        />
      </span>

      <span className="whitespace-nowrap text-xs font-semibold">
        Back to top
      </span>
    </button>,
    document.body,
  );
}