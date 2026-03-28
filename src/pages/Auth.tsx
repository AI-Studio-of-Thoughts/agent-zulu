import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useUser } from "@clerk/react";
import { useSignIn, useSignUp } from "@clerk/react/legacy";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Step = "credentials" | "verify-signup" | "verify-signin";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("credentials");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isSignedIn } = useUser();
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();

  useEffect(() => {
    if (isSignedIn) navigate("/", { replace: true });
  }, [isSignedIn, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInLoaded || !signUpLoaded) return;
    setLoading(true);

    try {
      // ── Step: verify sign-up email code ──────────────────
      if (step === "verify-signup") {
        const result = await signUp!.attemptEmailAddressVerification({ code });
        if (result.status === "complete") {
          await setSignUpActive!({ session: result.createdSessionId });
          toast.success("Account verified! Welcome to Agent Zulu.");
          navigate("/");
        } else {
          toast.error("Invalid code. Please try again.");
        }
        return;
      }

      // ── Step: verify sign-in second factor (new device) ──
      if (step === "verify-signin") {
        const attempt = await signIn!.attemptSecondFactor({ strategy: "email_code", code });
        if (attempt.status === "complete") {
          await setSignInActive!({ session: attempt.createdSessionId });
          toast.success("Welcome back!");
          navigate("/");
        } else {
          toast.error("Invalid code. Please try again.");
        }
        return;
      }

      // ── Step: credentials ─────────────────────────────────
      if (isLogin) {
        const result = await signIn!.create({ identifier: email, password });
        if (result.status === "complete") {
          await setSignInActive!({ session: result.createdSessionId });
          toast.success("Welcome back!");
          navigate("/");
        } else if (result.status === "needs_first_factor") {
          const attempt = await signIn!.attemptFirstFactor({ strategy: "password", password });
          if (attempt.status === "complete") {
            await setSignInActive!({ session: attempt.createdSessionId });
            toast.success("Welcome back!");
            navigate("/");
          } else if (attempt.status === "needs_second_factor") {
            await signIn!.prepareSecondFactor({ strategy: "email_code" });
            setStep("verify-signin");
            toast.success("Check your email for a verification code.");
          } else {
            toast.error(`Unexpected status: ${attempt.status}`);
          }
        } else if (result.status === "needs_second_factor") {
          await signIn!.prepareSecondFactor({ strategy: "email_code" });
          setStep("verify-signin");
          toast.success("Check your email for a verification code.");
        } else {
          toast.error(`Unexpected status: ${result.status}`);
        }
      } else {
        const result = await signUp!.create({
          emailAddress: email,
          password,
          firstName: displayName || email.split("@")[0],
        });
        if (result.status === "complete") {
          await setSignUpActive!({ session: result.createdSessionId });
          toast.success("Account created!");
          navigate("/");
        } else {
          await signUp!.prepareEmailAddressVerification({ strategy: "email_code" });
          setStep("verify-signup");
          toast.success("Check your email for a verification code.");
        }
      }
    } catch (err: any) {
      const message = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err.message || "Authentication failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const isVerifyStep = step !== "credentials";
  const title = step === "verify-signup" ? "VERIFY EMAIL"
    : step === "verify-signin" ? "NEW DEVICE CHECK"
    : isLogin ? "SIGN IN" : "CREATE ACCOUNT";

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background flex items-center justify-center">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px),
                            linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />
      <motion.div
        className="relative z-10 w-full max-w-sm mx-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl tracking-[0.2em] text-foreground text-glow mb-2">
            AGENT ZULU
          </h1>
          <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
            Sovereign AI Cockpit
          </p>
        </div>
        <form onSubmit={handleSubmit} className="glass-surface rounded-lg p-6 space-y-4">
          <h2 className="font-display text-sm tracking-[0.15em] text-foreground/80 text-center">
            {title}
          </h2>

          {isVerifyStep ? (
            <div>
              <label className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase block mb-1.5">
                {step === "verify-signin" ? "Security Code" : "Verification Code"}
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoFocus
                inputMode="numeric"
                className="w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm text-foreground font-body placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 tracking-[0.3em] text-center"
                placeholder="000000"
                maxLength={6}
              />
              <p className="font-mono text-[10px] text-muted-foreground mt-2 text-center">
                Sent to {email}
              </p>
            </div>
          ) : (
            <>
              {!isLogin && (
                <div>
                  <label className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase block mb-1.5">Display Name</label>
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm text-foreground font-body placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="Your name" />
                </div>
              )}
              <div>
                <label className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase block mb-1.5">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm text-foreground font-body placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="you@example.com" />
              </div>
              <div>
                <label className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase block mb-1.5">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm text-foreground font-body placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="••••••••" />
              </div>
            </>
          )}

          <button type="submit" disabled={loading || !signInLoaded || !signUpLoaded} className="w-full bg-primary/10 border border-primary/40 text-primary rounded-md py-2.5 font-display text-xs tracking-[0.15em] uppercase hover:bg-primary/20 transition-colors disabled:opacity-50">
            {loading ? "Processing…" : isVerifyStep ? "Verify" : isLogin ? "Sign In" : "Create Account"}
          </button>

          {!isVerifyStep && (
            <p className="text-center text-xs text-muted-foreground font-body">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline">
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </p>
          )}

          {isVerifyStep && (
            <p className="text-center text-xs text-muted-foreground font-body">
              <button type="button" onClick={() => { setStep("credentials"); setCode(""); }} className="text-primary hover:underline">
                Back
              </button>
            </p>
          )}
        </form>
      </motion.div>
    </div>
  );
};

export default Auth;
