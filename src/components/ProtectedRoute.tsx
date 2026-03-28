import { useUser } from "@clerk/react";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return (
      <div className="w-screen h-screen bg-background flex items-center justify-center">
        <div className="font-mono text-xs tracking-[0.3em] text-muted-foreground uppercase animate-pulse">
          Initializing…
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
