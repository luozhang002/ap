"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MANAGER_ENTERPRISES_DEFAULT_LIMIT,
  type ManagerEnterpriseCard,
} from "@/lib/crm-visited-enterprises";
import { EmptyStatePanel } from "./EmptyStatePanel";
import styles from "./page.module.css";

const DEBOUNCE_MS = 280;
const END_TOAST_MS = 2600;

function getScrollParent(node: HTMLElement | null): HTMLElement | null {
  if (!node) return null;
  let p: HTMLElement | null = node.parentElement;
  while (p) {
    const y = getComputedStyle(p).overflowY;
    if (y === "auto" || y === "scroll" || y === "overlay") {
      return p;
    }
    p = p.parentElement;
  }
  return null;
}

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}

type PagePayload = {
  items: ManagerEnterpriseCard[];
  nextCursor: number | null;
  hasMore: boolean;
};

async function fetchManagerEnterprises(
  params: { cursor?: number; name: string; city: string },
  signal?: AbortSignal,
): Promise<PagePayload> {
  const qs = new URLSearchParams({ limit: String(MANAGER_ENTERPRISES_DEFAULT_LIMIT) });
  if (params.cursor != null) qs.set("cursor", String(params.cursor));
  if (params.name) qs.set("name", params.name);
  if (params.city) qs.set("city", params.city);
  const res = await fetch(`/api/me/manager-enterprises?${qs.toString()}`, {
    credentials: "same-origin",
    signal,
  });
  const data = (await res.json()) as PagePayload & { error?: string };
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "加载失败");
  }
  return { items: data.items, nextCursor: data.nextCursor, hasMore: data.hasMore };
}

function EnterpriseCard({ e }: { e: ManagerEnterpriseCard }) {
  return (
    <li className={styles.visitCard}>
      <div className={styles.visitCardTop}>
        <span className={styles.visitCardName}>{e.customerName?.trim() || `企业 #${e.id}`}</span>
        <div className={styles.badges}>
          <span className={e.isVisited ? styles.statusVisited : styles.statusPending}>
            {e.isVisited ? "已拜访" : "未拜访"}
          </span>
          <span className={styles.kindBadge}>{e.sheetKindLabel}</span>
        </div>
      </div>
      {(e.province || e.city || e.district) && (
        <p className={styles.visitCardLine}>
          {[e.province, e.city, e.district].filter(Boolean).join(" · ")}
        </p>
      )}
      {e.issuedAddress?.trim() && (
        <p className={styles.visitCardAddr} title={e.issuedAddress}>
          {e.issuedAddress}
        </p>
      )}
      <dl className={styles.visitMeta}>
        {e.legalPersonName?.trim() && (
          <div className={styles.metaRow}>
            <dt>法人</dt>
            <dd>{e.legalPersonName.trim()}</dd>
          </div>
        )}
        {e.actualVisitTime && (
          <div className={styles.metaRow}>
            <dt>实际上门</dt>
            <dd>{e.actualVisitTime}</dd>
          </div>
        )}
        {e.lastVisitTime && (
          <div className={styles.metaRow}>
            <dt>最近上门</dt>
            <dd>{e.lastVisitTime}</dd>
          </div>
        )}
        {e.contactPhone?.trim() && (
          <div className={styles.metaRow}>
            <dt>联系电话</dt>
            <dd>{e.contactPhone}</dd>
          </div>
        )}
      </dl>
      {e.visitRemark?.trim() && (
        <p className={styles.visitRemark} title={e.visitRemark}>
          {e.visitRemark}
        </p>
      )}
    </li>
  );
}

export default function MyEnterprisesSection({ initialPage }: { initialPage: PagePayload }) {
  const [nameQ, setNameQ] = useState("");
  const [regionQ, setRegionQ] = useState("");
  const debouncedName = useDebouncedValue(nameQ, DEBOUNCE_MS);
  const debouncedCity = useDebouncedValue(regionQ, DEBOUNCE_MS);

  const [items, setItems] = useState<ManagerEnterpriseCard[]>(initialPage.items);
  const [nextCursor, setNextCursor] = useState<number | null>(initialPage.nextCursor);
  const [hasMore, setHasMore] = useState(initialPage.hasMore);

  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const skipHydratedFirstFetch = useRef(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const sectionRootRef = useRef<HTMLDivElement | null>(null);
  const wasAtBottomRef = useRef(false);
  const prevHasMoreRef = useRef<boolean | null>(null);
  const toastHideTimerRef = useRef<number | null>(null);

  const hasMoreRef = useRef(hasMore);
  const listLoadingRef = useRef(listLoading);
  const loadingMoreRef = useRef(loadingMore);
  hasMoreRef.current = hasMore;
  listLoadingRef.current = listLoading;
  loadingMoreRef.current = loadingMore;

  const [endToastVisible, setEndToastVisible] = useState(false);

  const showEndToast = useCallback(() => {
    if (toastHideTimerRef.current != null) {
      window.clearTimeout(toastHideTimerRef.current);
    }
    setEndToastVisible(true);
    toastHideTimerRef.current = window.setTimeout(() => {
      setEndToastVisible(false);
      toastHideTimerRef.current = null;
    }, END_TOAST_MS);
  }, []);

  useEffect(
    () => () => {
      if (toastHideTimerRef.current != null) window.clearTimeout(toastHideTimerRef.current);
    },
    [],
  );

  /** 搜索条件变化后重置「是否在底部」判定，避免误触提示 */
  useEffect(() => {
    wasAtBottomRef.current = false;
  }, [debouncedName, debouncedCity]);

  /** 滚到底部且已加载完：从「还有更多」变为「没有更多」时，若仍停在底部则提示 */
  useEffect(() => {
    if (prevHasMoreRef.current === null) {
      prevHasMoreRef.current = hasMore;
      return;
    }
    if (prevHasMoreRef.current && !hasMore && items.length > 0) {
      const scrollEl = getScrollParent(sectionRootRef.current);
      if (!scrollEl) {
        prevHasMoreRef.current = hasMore;
        return;
      }
      requestAnimationFrame(() => {
        const { scrollTop, clientHeight, scrollHeight } = scrollEl;
        if (scrollHeight <= clientHeight + 12) return;
        if (scrollTop + clientHeight < scrollHeight - 12) return;
        showEndToast();
      });
    }
    prevHasMoreRef.current = hasMore;
  }, [hasMore, items.length, showEndToast]);

  /** 已全部加载时：用户从非底部滚到「滚不动」时短暂提示 */
  useEffect(() => {
    const root = sectionRootRef.current;
    if (!root) return;
    const scrollEl = getScrollParent(root);
    if (!scrollEl) return;

    const onScroll = () => {
      if (hasMoreRef.current || listLoadingRef.current || loadingMoreRef.current) {
        wasAtBottomRef.current =
          scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 8;
        return;
      }
      const { scrollTop, clientHeight, scrollHeight } = scrollEl;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 8;
      const overflows = scrollHeight > clientHeight + 12;
      if (!overflows || items.length === 0) {
        wasAtBottomRef.current = atBottom;
        return;
      }
      const crossedIntoBottom = atBottom && !wasAtBottomRef.current && scrollTop > 16;
      wasAtBottomRef.current = atBottom;
      if (crossedIntoBottom) {
        showEndToast();
      }
    };

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, [items.length, showEndToast]);

  /** 追加一页后同步「是否在底部」，避免列表变长后误判 */
  useEffect(() => {
    if (loadingMore) return;
    const scrollEl = getScrollParent(sectionRootRef.current);
    if (!scrollEl) return;
    requestAnimationFrame(() => {
      const { scrollTop, clientHeight, scrollHeight } = scrollEl;
      wasAtBottomRef.current = scrollTop + clientHeight >= scrollHeight - 8;
    });
  }, [loadingMore, items.length]);

  /** 防抖后的关键词变化 → 重新拉第一页（搜索接口） */
  useEffect(() => {
    const name = debouncedName.trim();
    const city = debouncedCity.trim();

    if (skipHydratedFirstFetch.current) {
      if (name === "" && city === "") {
        skipHydratedFirstFetch.current = false;
        return;
      }
      skipHydratedFirstFetch.current = false;
    }

    const ac = new AbortController();
    setListLoading(true);
    setFetchError(null);

    fetchManagerEnterprises({ name, city }, ac.signal)
      .then((page) => {
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setHasMore(page.hasMore);
      })
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setFetchError(err instanceof Error ? err.message : "加载失败");
      })
      .finally(() => setListLoading(false));

    return () => ac.abort();
  }, [debouncedName, debouncedCity]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || listLoading || nextCursor == null) return;
    const name = debouncedName.trim();
    const city = debouncedCity.trim();
    setLoadingMore(true);
    setFetchError(null);
    try {
      const page = await fetchManagerEnterprises({
        cursor: nextCursor,
        name,
        city,
      });
      setItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, listLoading, nextCursor, debouncedName, debouncedCity]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit) void loadMore();
      },
      { root: null, rootMargin: "120px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  const name = debouncedName.trim();
  const city = debouncedCity.trim();
  const showEmptyNoEnterprise = items.length === 0 && !listLoading && name === "" && city === "";
  const showEmptyNoMatch = items.length === 0 && !listLoading && (name !== "" || city !== "");

  return (
    <>
      <div ref={sectionRootRef} className={styles.searchBar}>
        <input
          type="text"
          enterKeyHint="search"
          className={styles.searchInput}
          placeholder="企业名称"
          value={nameQ}
          onChange={(e) => setNameQ(e.target.value)}
          aria-label="按企业名称筛选"
          autoCapitalize="off"
          autoCorrect="off"
        />
        <input
          type="text"
          enterKeyHint="search"
          className={styles.searchInput}
          placeholder="市"
          value={regionQ}
          onChange={(e) => setRegionQ(e.target.value)}
          aria-label="按市筛选"
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>

      {fetchError && <p className={styles.fetchError}>{fetchError}</p>}

      {showEmptyNoEnterprise && <EmptyStatePanel variant="noEnterprises" />}
      {showEmptyNoMatch && <EmptyStatePanel variant="searchNoMatch" />}

      {!showEmptyNoEnterprise && !showEmptyNoMatch && items.length > 0 && (
        <ul className={styles.cardList} aria-label="负责企业列表">
          {items.map((e) => (
            <EnterpriseCard key={e.id} e={e} />
          ))}
        </ul>
      )}

      {items.length > 0 && hasMore && (
        <div ref={sentinelRef} className={styles.scrollSentinel} aria-hidden />
      )}

      {endToastVisible && (
        <div className={styles.endToast} role="status" aria-live="polite">
          已加载全部
        </div>
      )}
    </>
  );
}
