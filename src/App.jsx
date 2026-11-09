import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import PulseDashboard from './pages/PulseDashboard';
import RitusBoard from './pages/RitusBoard';
import SequaBoard from './pages/SequaBoard';
import ReportsAndTeam from './pages/ReportsAndTeam';

export default function App() {
    return (
        <AuthProvider>
            <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
                <Navbar />
                <main className="flex-1 pb-12">
                    <Routes>
                        <Route path="/" element={<PulseDashboard />} />
                        <Route path="/ritus" element={<RitusBoard />} />
                        <Route path="/sequa" element={<SequaBoard />} />
                        <Route path="/reports" element={<ReportsAndTeam />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </main>
            </div>
        </AuthProvider>
    );
}
