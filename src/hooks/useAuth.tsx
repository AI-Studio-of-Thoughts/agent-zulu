import { useUser, useClerk } from "@clerk/react";

export function useAuth() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  return {
    user,
    loading: !isLoaded,
    isAdmin: (user?.publicMetadata?.role as string) === "admin",
    signOut: async () => signOut({ redirectUrl: "/auth" }),
  };
}
