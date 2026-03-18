import { Route, Routes } from "react-router-dom";
import { Homepage } from "./App";

function DashboardPlaceholder() {
  return <div data-testid="dashboard" className="min-h-screen bg-dark text-text-light p-8">Dashboard</div>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Homepage />} />
      <Route path="/dashboard" element={<DashboardPlaceholder />} />
    </Routes>
  );
}
