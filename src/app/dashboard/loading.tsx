/**
 * Loading State - Dashboard
 * 
 * Este arquivo é automaticamente usado pelo Next.js
 * quando uma página do dashboard está carregando.
 */

import { Spinner } from "@/components/loading";

export default function DashboardLoading() {
    return (
        <div className="dash-loading">
            <div className="dash-loading-content">
                <Spinner size="xl" />
                <p className="dash-loading-text">Carregando...</p>
            </div>

            <style>{`
                .dash-loading {
                    min-height: 50vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .dash-loading-content {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 16px;
                }

                .dash-loading-text {
                    color: #94a3b8;
                    font-size: 15px;
                    margin: 0;
                }
            `}</style>
        </div>
    );
}
