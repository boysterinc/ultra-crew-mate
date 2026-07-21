import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import AthleteDetail from "./pages/AthleteDetail.tsx";
import NutritionPlan from "./pages/NutritionPlan.tsx";
import NutritionMatrix from "./pages/NutritionMatrix.tsx";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login.tsx";
import OAuthConsent from "./pages/OAuthConsent.tsx";
import { useAutoLapScannerLifecycle } from "@/lib/autoLapScanner";

const queryClient = new QueryClient();

const AutoLapLifecycle = () => {
  useAutoLapScannerLifecycle();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AutoLapLifecycle />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/athlete" element={<AthleteDetail />} />
          <Route path="/nutrition" element={<NutritionPlan />} />
          <Route path="/nutrition/edit" element={<NutritionMatrix />} />
          <Route path="/login" element={<Login />} />
          <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
