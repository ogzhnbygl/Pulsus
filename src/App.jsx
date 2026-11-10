import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import PulseDashboard from './pages/PulseDashboard';
import RitusBoard from './pages/RitusBoard';
import SequaBoard from './pages/SequaBoard';
import ReportsAndTeam from './pages/ReportsAndTeam';
import StaffManagement from './pages/StaffManagement';

function AppRoutes() {
    const { isVet, isCaretaker } = useAuth();
    return (
        <Routes>
            <Route path="/" element={<PulseDashboard />} />
            <Route
                path="/ritus"
                element={isCaretaker ? <Navigate to="/" replace /> : <RitusBoard />}
            />
            <Route
                path="/sequa"
                element={isCaretaker ? <Navigate to="/" replace /> : <SequaBoard />}
            />
            <Route
                path="/reports"
                element={isVet ? <ReportsAndTeam /> : <Navigate to="/" replace />}
            />
            <Route
                path="/staff"
                element={isVet ? <StaffManagement /> : <Navigate to="/" replace />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default function App() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
            <Navbar />
            <main className="flex-1 pb-12">
                <AppRoutes />
            </main>
        </div>
    );
}
