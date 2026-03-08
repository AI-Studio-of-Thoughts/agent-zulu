import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Analytics from "./pages/Analytics";
import NotFound from "./pages/NotFound";
import OfflineIndicator from "./components/OfflineIndicator";
import { initOutbox, type OutboxEntry } from "@/lib/offline-outbox";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

// Outbox flush handler — retries failed inserts
async function handleFlush(entry: OutboxEntry): Promise<boolean> {
  try {
    if (entry.target === "session_logs" || entry.target === "community_logs") {
      const { error } = await (supabase as any)
        .from(entry.target)
        .insert(entry.payload);
      return !error;
    }
    return false;
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
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
