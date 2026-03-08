CREATE TABLE public.session_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- No RLS needed — this is public anonymous telemetry (no user data, opt-in only)
ALTER TABLE public.session_logs ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anon/authenticated but no reads from client
CREATE POLICY "Allow anonymous inserts" ON public.session_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
