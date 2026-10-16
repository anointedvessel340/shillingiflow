CREATE TABLE public.auth_verification_proofs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, session_id text NOT NULL, method text NOT NULL, expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.auth_verification_proofs TO authenticated;
GRANT ALL ON public.auth_verification_proofs TO service_role;
ALTER TABLE public.auth_verification_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_proof_read ON public.auth_verification_proofs FOR SELECT TO authenticated USING (user_id=auth.uid() AND session_id=auth.jwt()->>'session_id');
CREATE INDEX auth_proofs_session ON public.auth_verification_proofs(user_id,session_id,expires_at);
CREATE TABLE public.auth_request_limits (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subject text NOT NULL, purpose text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.auth_request_limits TO service_role;
ALTER TABLE public.auth_request_limits ENABLE ROW LEVEL SECURITY;
CREATE INDEX auth_requests_window ON public.auth_request_limits(subject,purpose,created_at);
CREATE OR REPLACE FUNCTION public.reserve_auth_request(p_subject text,p_purpose text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
PERFORM pg_advisory_xact_lock(hashtextextended(p_subject||':'||p_purpose,0));
IF EXISTS(SELECT 1 FROM public.auth_request_limits WHERE subject=p_subject AND purpose=p_purpose AND created_at>now()-interval '60 seconds') OR (SELECT count(*) FROM public.auth_request_limits WHERE subject=p_subject AND purpose=p_purpose AND created_at>now()-interval '1 hour')>=3 THEN RETURN false; END IF;
INSERT INTO public.auth_request_limits(subject,purpose) VALUES(p_subject,p_purpose); RETURN true; END $$;
REVOKE ALL ON FUNCTION public.reserve_auth_request(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_auth_request(text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.get_session_context(p_legal_version text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT jsonb_build_object('role',a.role,'access',coalesce(a.status='active',false),'aal',auth.jwt()->>'aal','mfa_required',EXISTS(SELECT 1 FROM auth.mfa_factors f WHERE f.user_id=auth.uid() AND f.status='verified'), 'legal',coalesce((SELECT jsonb_agg(jsonb_build_object('document_type',document_type,'version',version)) FROM public.legal_acceptances l WHERE l.user_id=auth.uid() AND l.version=p_legal_version),'[]'::jsonb),'auto_lock_minutes',coalesce(p.auto_lock_minutes,15)) FROM auth.users u LEFT JOIN public.approved_emails a ON a.email=lower(u.email) LEFT JOIN public.profiles p ON p.id=u.id WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.get_session_context(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_session_context(text) TO authenticated;
COMMENT ON TABLE public.auth_verification_proofs IS 'Five-minute proofs issued only after server verification, bound to user and auth session.';