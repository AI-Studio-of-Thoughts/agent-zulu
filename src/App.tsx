import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Analytics from "./pages/Analytics";
import NotFound from "./pages/NotFound";
import OfflineIndicator from "./components/OfflineIndicator";
import { initOutbox, type OutboxEntry } from "@/lib/offline-outbox";

const queryClient = new QueryClient();

async function handleFlush(entry: OutboxEntry): Promise<boolean> {
  try {
    const endpoint = entry.target === "session_logs" ? "/api/log-session" : "/api/log-community";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry.payload),
    });
    return response.ok;
  } catch {
    return false;
  }
}

const App = () => {
  useEffect(() => {
    initOutbox(handleFlush);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <OfflineIndicator />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
