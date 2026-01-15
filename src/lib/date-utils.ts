/**
 * Date Formatting Utilities
 * 
 * Utilitários para formatação de datas/horários consistente em toda aplicação.
 * Configurado para pt-BR.
 */

/**
 * Formata um timestamp para horário (HH:mm)
 */
export function formatTime(date: string | Date): string {
    return new Date(date).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

/**
 * Formata um timestamp para data amigável (hoje = horário, ontem = "Ontem", outros = DD/MM)
 */
export function formatRelativeDate(date: string | Date): string {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);

    if (diffDays === 0) return formatTime(date);
    if (diffDays === 1) return "Ontem";

    return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
    });
}

/**
 * Formata um timestamp para data completa (DD/MM/YYYY)
 */
export function formatFullDate(date: string | Date): string {
    return new Date(date).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

/**
 * Formata um timestamp para data e hora (DD/MM/YYYY HH:mm)
 */
export function formatDateTime(date: string | Date): string {
    const d = new Date(date);
    return `${formatFullDate(d)} ${formatTime(d)}`;
}

/**
 * Retorna quanto tempo passou desde a data (ex: "há 5 min", "há 2h", "há 3 dias")
 */
export function formatTimeAgo(date: string | Date): string {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();

    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) return "agora";
    if (diffMinutes < 60) return `há ${diffMinutes} min`;
    if (diffHours < 24) return `há ${diffHours}h`;
    if (diffDays === 1) return "ontem";
    if (diffDays < 7) return `há ${diffDays} dias`;

    return formatRelativeDate(date);
}
