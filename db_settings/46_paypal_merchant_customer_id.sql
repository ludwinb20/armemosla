-- Resolver admin UUID desde merchant_customer_id de PayPal (22 chars derivados del user id)
CREATE OR REPLACE FUNCTION public.admin_id_from_paypal_merchant_customer_id(p_merchant_id text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.profiles
  WHERE left(replace(id::text, '-', ''), char_length(p_merchant_id)) = p_merchant_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.admin_id_from_paypal_merchant_customer_id(text) TO service_role;
