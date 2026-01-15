/**
 * Loading State - Admin
 * 
 * Este arquivo é automaticamente usado pelo Next.js
 * quando uma página do admin está carregando.
 */

import { Spinner } from "@/components/loading";

export default function AdminLoading() {
    return (
        <div style={{
            minHeight: '50vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
        }}>
            <Spinner size="xl" color="#8b5cf6" />
            <p style={{ color: '#94a3b8', fontSize: '15px', margin: 0 }}>
                Carregando...
            </p>
        </div>
    );
}
