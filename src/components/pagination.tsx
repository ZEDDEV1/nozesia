"use client";

/**
 * Componente de Paginação
 * 
 * Suporta dois modos:
 * - Cursor-based: botão "Carregar mais"
 * - Offset-based: navegação por páginas
 */

import { ChevronLeft, ChevronRight, Loader2, MoreHorizontal } from "lucide-react";

interface PaginationInfo {
    page?: number;
    limit: number;
    total?: number;
    totalPages?: number;
    hasMore: boolean;
    nextCursor?: string;
}

interface LoadMoreButtonProps {
    hasMore: boolean;
    loading?: boolean;
    onClick: () => void;
    className?: string;
}

interface PageNavigationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    className?: string;
}

interface InfiniteScrollTriggerProps {
    hasMore: boolean;
    loading?: boolean;
    onLoadMore: () => void;
}

// ============================================
// LOAD MORE BUTTON (Cursor-based)
// ============================================

export function LoadMoreButton({
    hasMore,
    loading = false,
    onClick,
    className = ""
}: LoadMoreButtonProps) {
    if (!hasMore) return null;

    return (
        <button
            onClick={onClick}
            disabled={loading}
            className={`pagination-load-more ${className}`}
            style={styles.loadMoreBtn}
        >
            {loading ? (
                <>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    Carregando...
                </>
            ) : (
                <>
                    <MoreHorizontal size={16} />
                    Carregar mais
                </>
            )}
        </button>
    );
}

// ============================================
// PAGE NAVIGATION (Offset-based)
// ============================================

export function PageNavigation({
    currentPage,
    totalPages,
    onPageChange,
    className = ""
}: PageNavigationProps) {
    if (totalPages <= 1) return null;

    const pages = getPageNumbers(currentPage, totalPages);

    return (
        <nav className={`pagination-nav ${className}`} style={styles.nav}>
            {/* Previous */}
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                style={{
                    ...styles.pageBtn,
                    ...(currentPage === 1 ? styles.pageBtnDisabled : {}),
                }}
            >
                <ChevronLeft size={16} />
            </button>

            {/* Page Numbers */}
            {pages.map((page, index) => (
                page === '...' ? (
                    <span key={`ellipsis-${index}`} style={styles.ellipsis}>...</span>
                ) : (
                    <button
                        key={page}
                        onClick={() => onPageChange(page as number)}
                        style={{
                            ...styles.pageBtn,
                            ...(currentPage === page ? styles.pageBtnActive : {}),
                        }}
                    >
                        {page}
                    </button>
                )
            ))}

            {/* Next */}
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{
                    ...styles.pageBtn,
                    ...(currentPage === totalPages ? styles.pageBtnDisabled : {}),
                }}
            >
                <ChevronRight size={16} />
            </button>
        </nav>
    );
}

// ============================================
// PAGINATION INFO TEXT
// ============================================

export function PaginationInfo({
    pagination
}: {
    pagination: PaginationInfo
}) {
    if (pagination.total === undefined) {
        return (
            <p style={styles.infoText}>
                Mostrando {pagination.limit} itens
                {pagination.hasMore && " (mais disponíveis)"}
            </p>
        );
    }

    const start = ((pagination.page || 1) - 1) * pagination.limit + 1;
    const end = Math.min((pagination.page || 1) * pagination.limit, pagination.total);

    return (
        <p style={styles.infoText}>
            Mostrando {start}-{end} de {pagination.total} itens
        </p>
    );
}

// ============================================
// INFINITE SCROLL TRIGGER
// ============================================

export function InfiniteScrollTrigger({
    hasMore,
    loading = false,
    onLoadMore
}: InfiniteScrollTriggerProps) {
    if (!hasMore) return null;

    return (
        <div
            style={styles.infiniteTrigger}
            ref={(el) => {
                if (!el) return;

                const observer = new IntersectionObserver(
                    (entries) => {
                        if (entries[0].isIntersecting && !loading) {
                            onLoadMore();
                        }
                    },
                    { threshold: 0.1 }
                );

                observer.observe(el);
                return () => observer.disconnect();
            }}
        >
            {loading && (
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: '#64748b' }} />
            )}
        </div>
    );
}

// ============================================
// HELPERS
// ============================================

function getPageNumbers(currentPage: number, totalPages: number): (number | '...')[] {
    const pages: (number | '...')[] = [];
    const showPages = 5;

    if (totalPages <= showPages) {
        for (let i = 1; i <= totalPages; i++) {
            pages.push(i);
        }
    } else {
        // Always show first page
        pages.push(1);

        if (currentPage > 3) {
            pages.push('...');
        }

        // Show pages around current
        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }

        if (currentPage < totalPages - 2) {
            pages.push('...');
        }

        // Always show last page
        if (totalPages > 1) {
            pages.push(totalPages);
        }
    }

    return pages;
}

// ============================================
// STYLES
// ============================================

const styles = {
    loadMoreBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        width: '100%',
        padding: '12px 24px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        color: '#94a3b8',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s',
    } as React.CSSProperties,
    nav: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
    } as React.CSSProperties,
    pageBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '36px',
        height: '36px',
        padding: '0 8px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '6px',
        color: '#94a3b8',
        fontSize: '14px',
        cursor: 'pointer',
        transition: 'all 0.2s',
    } as React.CSSProperties,
    pageBtnActive: {
        background: 'linear-gradient(135deg, #10b981, #06b6d4)',
        borderColor: 'transparent',
        color: 'white',
    } as React.CSSProperties,
    pageBtnDisabled: {
        opacity: 0.4,
        cursor: 'not-allowed',
    } as React.CSSProperties,
    ellipsis: {
        padding: '0 8px',
        color: '#64748b',
    } as React.CSSProperties,
    infoText: {
        margin: 0,
        fontSize: '13px',
        color: '#64748b',
    } as React.CSSProperties,
    infiniteTrigger: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '48px',
    } as React.CSSProperties,
};
