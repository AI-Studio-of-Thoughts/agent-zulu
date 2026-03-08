
-- Community Data Flywheel: anonymous shared logs for collective training
CREATE TABLE public.community_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  language TEXT DEFAULT 'isizulu',
  region TEXT DEFAULT 'unknown',
  session_hash TEXT NOT NULL,
  device_hash TEXT DEFAULT 'unknown'
);

-- Enable RLS
ALTER TABLE public.community_logs ENABLE ROW LEVEL SECURITY;

-- Anyone can read community data (it's anonymous and public by design)
CREATE POLICY "Community logs are publicly readable"
  ON public.community_logs FOR SELECT
  USING (true);

-- Anyone can insert anonymous logs (no auth required for opt-in sharing)
CREATE POLICY "Anyone can contribute anonymous logs"
  ON public.community_logs FOR INSERT
  WITH CHECK (true);

-- Enable realtime for community stats
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_logs;
