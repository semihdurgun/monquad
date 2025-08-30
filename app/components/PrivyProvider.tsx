"use client";
import { LoginMethodOrderOption, PrivyProvider } from "@privy-io/react-auth";

export default function Providers({ children }: { children: React.ReactNode }) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_CROSS_APP_ID || "";
  const monadCrossAppId = "privy:" + (process.env.NEXT_PUBLIC_MONAD_CROSS_APP_ID || "");

  if (!privyAppId || !monadCrossAppId) {
    throw new Error("Privy app ID or Monad Cross App ID is not set");
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethodsAndOrder: {
          primary: [monadCrossAppId as LoginMethodOrderOption],
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
